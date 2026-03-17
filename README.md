# Fwishium
<img width="1550" height="500" alt="Image" src="https://github.com/user-attachments/assets/a56141b4-e2c8-4276-a6a8-e819748bf25b" />

### What is Fwishium?
Fwishium is a lightweight client modification plugin that helps optimize the Discord client. It displays live telemetry for RAM (RSS and heap) and CPU usage with a candlestick chart for monitoring trends over time. When unfocused, it throttles background activity, suppressing non-critical Flux dispatches, pausing CSS animations, and hiding inactive video elements to cut resource usage. It also includes an animation throttler that swaps animated emoji and GIFs for static previews, reducing decode overhead even while focused. All features are independently togglable inside the config.

## Roadmap

### Alpha
- [x] ~~Live RAM & CPU usage indicator (RSS & Heap)~~
- [X] ~~Background throttle mode (reduce updates when unfocused)~~
- [X] ~~Animation throttler (animated emoji / GIF / autoplay control)~~
- [ ] Custom settings & experimental toggles

### Release
- [ ] Support server
- [ ] Officially added to [Betterdiscord](https://betterdiscord.app/plugins)
- [ ] Better compatibility with themes and plugins
- [ ] Presets: Lite / Balanced / Max Performance

## Installation

BetterDiscord
1. Download `Fwishium.plugin.js ` from this repository's Releases.
2. Place the file in your BetterDiscord plugins folder:
   - Windows: `%appdata%\BetterDiscord\plugins`
   - macOS: `~/Library/Application Support/BetterDiscord/plugins`
   - Linux: `~/.config/BetterDiscord/plugins`
3. Open BetterDiscord → Plugins and enable Fwishium.
4. Open the plugin settings to configure diverse settings

## Contributing
Contributions are welcome. If you'd like to contribute:
- Open an issue to discuss major changes or report bugs.
- Contact me via [Discord](http://discord.com/users/607822260362805259) for any PR's
- Keep performance changes small and include notes on how they were measured or tested.

## Links
- Repository: https://github.com/fwishr/fwishium
- Support / Discussion: *Coming Later*

## License
MIT — see the LICENSE file for details.
