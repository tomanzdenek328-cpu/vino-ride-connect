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
  if (source.includes("public void connectInsecure(PluginCall call)")) return source;

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

  if (!source.includes(marker)) {
    throw new Error("Bluetooth plugin patch failed: insertion marker not found");
  }
  return source.replace(marker, `${method}${marker}`);
});

patchFile(servicePath, (source) => {
  if (source.includes("createRfcommSocket fallback")) return source;

  const start = source.indexOf("        @SuppressLint(\"MissingPermission\")\n        private void createRfcomm");
  const end = source.indexOf("\n\n        public void run()", start);
  if (start === -1 || end === -1) {
    throw new Error("Bluetooth service patch failed: createRfcomm block not found");
  }

  const replacement = `        @SuppressLint("MissingPermission")
        private void createRfcomm(BluetoothDevice device, boolean secure) {
            String socketType = secure ? "Secure" : "Insecure";
            Log.d(TAG, "BEGIN create socket SocketType:" + socketType);
            status = ConnectionStatus.CONNECTING;

            try {
                socket = createDefaultSocket(device, secure);
                Log.d(TAG, "BEGIN connect SocketType:" + socketType);
                socket.connect();
                Log.i(TAG, "Connection success - SocketType:" + socketType);
                connected();
                return;
            } catch (IOException firstError) {
                Log.e(TAG, "Default SPP connect failed, trying createRfcommSocket fallback", firstError);
                closeQuietly(socket);
            }

            try {
                socket = createChannelOneSocket(device, secure);
                Log.d(TAG, "BEGIN fallback connect SocketType:" + socketType);
                socket.connect();
                Log.i(TAG, "Fallback connection success - SocketType:" + socketType);
                connected();
            } catch (Exception fallbackError) {
                Log.e(TAG, "Socket Type: " + socketType + " createRfcommSocket fallback failed", fallbackError);
                closeQuietly(socket);
                connectionFailed();
            }
        }

        private BluetoothSocket createDefaultSocket(BluetoothDevice device, boolean secure) throws IOException {
            if (secure) {
                return device.createRfcommSocketToServiceRecord(DEFAULT_UUID);
            }
            return device.createInsecureRfcommSocketToServiceRecord(DEFAULT_UUID);
        }

        private BluetoothSocket createChannelOneSocket(BluetoothDevice device, boolean secure) throws Exception {
            String methodName = secure ? "createRfcommSocket" : "createInsecureRfcommSocket";
            java.lang.reflect.Method method = device.getClass().getMethod(methodName, int.class);
            return (BluetoothSocket) method.invoke(device, 1);
        }

        private void closeQuietly(BluetoothSocket socket) {
            if (socket == null) return;
            try {
                socket.close();
            } catch (IOException ignored) {
                // Ignore cleanup failure.
            }
        }`;

  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
});