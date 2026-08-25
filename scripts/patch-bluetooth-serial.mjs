import { readFileSync, writeFileSync, existsSync } from "node:fs";

const pluginPath = "node_modules/@e-is/capacitor-bluetooth-serial/android/src/main/java/com/bluetoothserial/plugin/BluetoothSerialPlugin.java";
const servicePath = "node_modules/@e-is/capacitor-bluetooth-serial/android/src/main/java/com/bluetoothserial/BluetoothSerialService.java";

function patchFile(path, patcher) {
  if (!existsSync(path)) {
    console.log(`Bluetooth patch skipped, missing ${path}`);
    return;
  }
  const before = readFileSync(path, "utf8");
  const after = patcher(before);
  if (after !== before) {
    writeFileSync(path, after);
    console.log(`Bluetooth patch applied: ${path}`);
  } else {
    console.log(`Bluetooth patch already applied: ${path}`);
  }
}

patchFile(pluginPath, (source) => {
  let next = source;

  if (!next.includes("public void connectInsecure(PluginCall call)")) {
    const marker = "\n\n  public void connected() {";
    const method = `

  @PluginMethod()
  public void connectInsecure(PluginCall call) {
    String address = getAddress(call);

    if (address == null) {
      call.reject(ERROR_ADDRESS_MISSING);
      return;
    }

    if (rejectIfDisabled(call)) {
      return;
    }

    BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
    if (device == null) {
      call.reject(ERROR_DEVICE_NOT_FOUND);
      return;
    }

    connectCall = call;
    getService().connectInsecure(device, this);
  }
`;

    if (!next.includes(marker)) {
      throw new Error("Bluetooth plugin patch failed: insertion marker not found");
    }
    next = next.replace(marker, `${method}${marker}`);
  }

  if (!next.includes("public void pairedDevices(PluginCall call)")) {
    const marker = "\n\n  @PluginMethod()\n  public void connect(PluginCall call) {";
    const method = `

  @PluginMethod()
  @SuppressLint("MissingPermission")
  public void pairedDevices(PluginCall call) {
    if (rejectIfDisabled(call)) {
      return;
    }

    resolveScanDevices(call, bluetoothAdapter.getBondedDevices());
  }
`;

    if (!next.includes(marker)) {
      throw new Error("Bluetooth plugin patch failed: pairedDevices marker not found");
    }
    next = next.replace(marker, `${method}${marker}`);
  }

  if (!next.includes('case "connectInsecure":')) {
    const marker = `            case "connect":
                connect(call);
                break;`;
    const replacement = `            case "connect":
                connect(call);
                break;
            case "connectInsecure":
                connectInsecure(call);
                break;
            case "pairedDevices":
                pairedDevices(call);
                break;`;

    if (!next.includes(marker)) {
      throw new Error("Bluetooth plugin patch failed: permission callback marker not found");
    }
    next = next.replace(marker, replacement);
  }

  return next;
});

patchFile(servicePath, (source) => {
  if (source.includes("MPT5 async connect patch")) return source;

  let next = source;

  next = next.replace(
    `    public boolean disconnectAllDevices() {
        boolean success = true;
        for(String address : connections.keySet()) {
            success = success & disconnect(address);
        }

        return success;
    }`,
    `    public boolean disconnectAllDevices() {
        boolean success = true;
        for(String address : new ArrayList<>(connections.keySet())) {
            success = success & disconnect(address);
        }

        return success;
    }`,
  );

  next = next.replace(
    `    public boolean disconnect(String address) {
        Log.d(TAG, "BEGIN disconnect device " + address);

        BluetoothConnection socket = getConnection(address);

        if(socket == null) {
            Log.e(TAG, "No connection found");
            return true;
        }

        if(!socket.isConnected()) {
            Log.i(TAG, "Device is already disconnected");
        } else {
            return socket.disconnect();
        }

        BluetoothConnection connection = connections.get(address);
        if(connection != null) {
            connection.interrupt();
        }

        connections.remove(address);
        Log.d(TAG, "END disconnect device " + address);

        return true;
    }`,
    `    public boolean disconnect(String address) {
        Log.d(TAG, "BEGIN disconnect device " + address);

        BluetoothConnection connection = getConnection(address);

        if(connection == null) {
            Log.e(TAG, "No connection found");
            return true;
        }

        boolean success = connection.disconnect();
        connection.interrupt();
        connections.remove(address);
        Log.d(TAG, "END disconnect device " + address);

        return success;
    }`,
  );

  const constructorStart = next.indexOf("        @SuppressLint(\"MissingPermission\")\n        public BluetoothConnection(BluetoothDevice device, boolean secure, BluetoothSerialPlugin plugin)");
  const constructorEnd = next.indexOf("\n\n        public BluetoothConnection(BluetoothConnection connection)", constructorStart);
  if (constructorStart === -1 || constructorEnd === -1) {
    throw new Error("Bluetooth service patch failed: constructor block not found");
  }

  const constructorReplacement = `        @SuppressLint("MissingPermission")
        public BluetoothConnection(BluetoothDevice device, boolean secure, BluetoothSerialPlugin plugin) {
            this.device = device;
            this.secure = secure;
            this.plugin = plugin;
            this.status = ConnectionStatus.NOT_CONNECTED;
            adapter.cancelDiscovery();
            readBuffer = new StringBuffer();
            this.enabledNotifications = false;
        }`;

  next = `${next.slice(0, constructorStart)}${constructorReplacement}${next.slice(constructorEnd)}`;

  const createStart = next.indexOf("        @SuppressLint(\"MissingPermission\")\n        private void createRfcomm");
  const createEnd = next.indexOf("\n\n        public void run()", createStart);
  if (createStart === -1 || createEnd === -1) {
    throw new Error("Bluetooth service patch failed: createRfcomm block not found");
  }

  const createReplacement = `        @SuppressLint("MissingPermission")
        private void createRfcomm(BluetoothDevice device, boolean secure) {
            String socketType = secure ? "Secure" : "Insecure";
            Log.d(TAG, "BEGIN MPT5 async connect patch SocketType:" + socketType);
            status = ConnectionStatus.CONNECTING;

            List<BluetoothSocket> candidates = new ArrayList<>();
            tryAddDefaultSocket(candidates, device, secure);
            tryAddPublishedUuidSockets(candidates, device, secure);
            for (int channel = 1; channel <= 8; channel++) {
                tryAddChannelSocket(candidates, device, secure, channel);
            }

            Exception lastError = null;
            for (BluetoothSocket candidate : candidates) {
                socket = candidate;
                adapter.cancelDiscovery();
                try {
                    Log.d(TAG, "BEGIN connect candidate SocketType:" + socketType);
                    socket.connect();
                    socketInputStream = getInputStream(socket);
                    socketOutputStream = getOutputStream(socket);
                    if (socketInputStream == null || socketOutputStream == null) {
                        throw new IOException("Bluetooth stream is not available");
                    }
                    Log.i(TAG, "Connection success - SocketType:" + socketType);
                    connected();
                    return;
                } catch (Exception connectError) {
                    lastError = connectError;
                    Log.e(TAG, "SPP connect candidate failed", connectError);
                    closeQuietly(socket);
                }
            }

            Log.e(TAG, "All SPP connection candidates failed", lastError);
            connectionFailed();
        }

        private void tryAddDefaultSocket(List<BluetoothSocket> candidates, BluetoothDevice device, boolean secure) {
            try {
                candidates.add(createDefaultSocket(device, secure));
            } catch (IOException e) {
                Log.e(TAG, "Default SPP socket creation failed", e);
            }
        }

        @SuppressLint("MissingPermission")
        private void tryAddPublishedUuidSockets(List<BluetoothSocket> candidates, BluetoothDevice device, boolean secure) {
            android.os.ParcelUuid[] uuids = device.getUuids();
            if (uuids == null) return;
            for (android.os.ParcelUuid uuid : uuids) {
                if (uuid == null || DEFAULT_UUID.equals(uuid.getUuid())) continue;
                try {
                    if (secure) {
                        candidates.add(device.createRfcommSocketToServiceRecord(uuid.getUuid()));
                    } else {
                        candidates.add(device.createInsecureRfcommSocketToServiceRecord(uuid.getUuid()));
                    }
                } catch (IOException e) {
                    Log.e(TAG, "Published UUID socket creation failed: " + uuid.getUuid(), e);
                }
            }
        }

        private void tryAddChannelSocket(List<BluetoothSocket> candidates, BluetoothDevice device, boolean secure, int channel) {
            try {
                candidates.add(createChannelSocket(device, secure, channel));
            } catch (Exception e) {
                Log.e(TAG, "Channel socket creation failed: " + channel, e);
            }
        }

        private BluetoothSocket createDefaultSocket(BluetoothDevice device, boolean secure) throws IOException {
            if (secure) {
                return device.createRfcommSocketToServiceRecord(DEFAULT_UUID);
            }
            return device.createInsecureRfcommSocketToServiceRecord(DEFAULT_UUID);
        }

        private BluetoothSocket createChannelSocket(BluetoothDevice device, boolean secure, int channel) throws Exception {
            String methodName = secure ? "createRfcommSocket" : "createInsecureRfcommSocket";
            java.lang.reflect.Method method = device.getClass().getMethod(methodName, int.class);
            return (BluetoothSocket) method.invoke(device, channel);
        }

        private void closeQuietly(BluetoothSocket socket) {
            if (socket == null) return;
            try {
                socket.close();
            } catch (IOException ignored) {
                // Ignore cleanup failure.
            }
        }`;

  next = `${next.slice(0, createStart)}${createReplacement}${next.slice(createEnd)}`;

  const runStart = next.indexOf("        public void run() {");
  const runEnd = next.indexOf("\n\n        private void appendToBuffer", runStart);
  if (runStart === -1 || runEnd === -1) {
    throw new Error("Bluetooth service patch failed: run block not found");
  }

  const runReplacement = `        public void run() {
            Log.i(TAG, "BEGIN connectedThread");
            createRfcomm(device, secure);
            if (status != ConnectionStatus.CONNECTED) {
                Log.i(TAG, "END connectedThread - connection was not opened");
                return;
            }

            byte[] bytesBuffer = new byte[1024];

            // Keep listening to the InputStream while connected
            while (status == ConnectionStatus.CONNECTED && !isInterrupted()) {
                try {
                    // Read from the InputStream
                    int length = socketInputStream.read(bytesBuffer);
                    if (length < 0) {
                        disconnect();
                        break;
                    }
                    String data = new String(bytesBuffer, 0, length);
                    appendToBuffer(data);
                } catch (IOException e) {
                    Log.e(TAG, "disconnected", e);
                    disconnect();
                    break;
                }
            }
            Log.i(TAG, "END connectedThread");
        }`;

  next = `${next.slice(0, runStart)}${runReplacement}${next.slice(runEnd)}`;

  next = next.replace(
    `        public boolean disconnect() {
            try {
                socket.close();
            } catch (IOException e) {
                Log.e(TAG, "close() of connect socket failed", e);
                return false;
            }

            return true;
        }`,
    `        public boolean disconnect() {
            status = ConnectionStatus.NOT_CONNECTED;
            try {
                if (socketInputStream != null) socketInputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "close() of input stream failed", e);
            }
            try {
                if (socketOutputStream != null) socketOutputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "close() of output stream failed", e);
            }
            try {
                if (socket != null) socket.close();
            } catch (IOException e) {
                Log.e(TAG, "close() of connect socket failed", e);
                return false;
            }

            return true;
        }`,
  );

  next = next.replace(
    `        public boolean isConnected() {
            return socket.isConnected();
        }`,
    `        public boolean isConnected() {
            return socket != null && socket.isConnected() && status == ConnectionStatus.CONNECTED;
        }`,
  );

  next = next.replace(
    `            createRfcomm(device, secure);
            socketInputStream = getInputStream(socket);
            socketOutputStream = getOutputStream(socket);`,
    `            createRfcomm(device, secure);`,
  );

  return next;
});
