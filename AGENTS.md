# Architecture rules
- Dispatcher assistance lives in focused UI components and authenticated server functions; server-only modules own AI calls and read live data with the caller's permissions, so recommendations cannot grant privileges or silently alter orders.
- Voice uploads use a size-bounded, dispatcher-authorized streaming server route and complete PCM WAV recordings, so web and Android recordings remain decodable.
- Driver recommendations use tariff capacities and fresh locations with deterministic distance ranking, so seating and availability are not invented by AI.
