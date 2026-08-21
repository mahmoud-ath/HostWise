# HostWise — Local downloads

Drop the built installers here (this folder is served at `/downloads/...`).
Name them exactly like the Download section expects:

```
HostWise_0.8.2_universal.dmg      # macOS
HostWise_0.8.2_x64-setup.exe      # Windows (NSIS)
hostwise_0.8.2_amd64.deb          # Linux (Debian / Ubuntu)
hostwise-0.8.2-1.x86_64.rpm       # Linux (Fedora / RHEL)
HostWise_0.8.2_amd64.AppImage     # Linux (AppImage)
```

Bump the version in `src/lib/constants.ts` (`DOWNLOAD_VERSION`) when you
rebuild, then regenerate the files with these names. Arch/Manjaro users
install from the AUR (`hostwise-bin`) instead of a local file.
