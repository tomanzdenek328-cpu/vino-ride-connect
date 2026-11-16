# Architecture rules
- Customer arrival uses a separate pickup-departure timestamp, authenticated assigned-driver writes, and a durable one-minute Routes calculation claim shared by customer viewers; passenger-trip status and public position polling never trigger billable ETA calls.
- Dispatcher assistance lives in focused UI components and authenticated server functions; server-only modules own AI calls and read live data with the caller's permissions, so recommendations cannot grant privileges or silently alter orders.
- Voice uploads use a size-bounded, dispatcher-authorized streaming server route and complete PCM WAV recordings, so web and Android recordings remain decodable.
- Driver recommendations use tariff capacities and fresh locations with deterministic distance ranking, so seating and availability are not invented by AI.
- Translator voice uses authenticated, bounded WAV uploads and streamed PCM speech; completed audio is reused within the open panel to avoid billing again on replay.
- Translator language and voice rules live in a shared browser-safe settings module; voice preference is stored per account locally and audio cache keys include voice, avoiding gender inference and incorrect cached playback.
