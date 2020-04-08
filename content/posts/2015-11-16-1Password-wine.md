---
authors: ["brice.dutheil"]
date: "2015-11-16T00:00:00Z"
meta: {}
published: true
tags:
- 1Password
- wine
- Linux
- systemd
slug: 1Password-wine
title: Install 1Password & browser agent with wine on Linux
---

Before starting, this install method is based on 1Password **4**, it may work with future versions,
but it is not guaranteed. Last tested version is **4.1.0.530**.

## Install WINE

```sh
sudo apt-get install wine
```

## Download 1Password

Running 1Password on Ubuntu requires the Windows version. You can grab it at the
[AgileBits Downloads page](https://agilebits.com/onepassword/windows).

## Install 1Password in WINE

Use Wine to install 1Password by entering this command:

```sh
wine 1Password-4.1.0.530.exe
```

This will install 1Password in your Wine directory and start the 1Password Windows installer.

Select the default install location : `C:\Program Files (x86)\1Password 4` it will be installed to the Wine
folder in your home directory.

Next you are given the opportunity to create a Start Menu shortcut. Since you are on Ubuntu, there is not really
a start menu. **Check** the checkbox for _Don’t create a Start Menu folder_.

**Check** the checkbox for _Create a desktop icon_ if you want one and click the Next button.

## Run 1Password

The simplest way to run 1Password is to use the Desktop icon. If you chose to install a Desktop icon keep
in mind that it will probably not show up until after a reboot of the system.

If you didn’t install a Desktop icon, you can start Dropbox in the command line.

Assuming you chose the default directory when installing 1Password, run it with:

```sh
~/.wine/drive_c/Program\ Files\ \(x86\)/1Password\ 4/1Password.exe
```

## Integration with a browser

### Manually (almost) run both

To run 1Password on Ubuntu 14.04, install Wine via apt-get. **You must start both** `1Password.exe` and `Agile1Agent.exe` to get connection to the browser. Here's my script:

```sh
#!/bin/sh
echo "Starting 1Password..."

wine ~/.wine/drive_c/Program\ Files\ \(x86\)/1Password\ 4/1Password.exe >> /tmp/1pwd-wine.txt 2>&1 &
wine ~/.wine/drive_c/Program\ Files\ \(x86\)/1Password\ 4/Agile1pAgent.exe >> /tmp/1pwd-wine.txt 2>&1 &

tail /tmp/1pwd.txt
echo "Started..."
```

### Using systemd

Or better with the run 1Password agent with systemd when logging.
We need to create a user systemd unit, let's call it `1Password.agent.service`

```
$HOME/.comfig/systemd/user/1Password.agent.service
```

Paste the following content

```
[Unit]
Description=1Password agent
After=display-manager.service

[Service]
ExecStart=/usr/bin/wine ".wine/drive_c/Program Files (x86)/1Password 4/Agile1pAgent.exe"
Restart=always
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
```

Edit it later with systemd command `systemctl`

```sh
systemctl --user edit --full 1Password.agent.service
```


Then in 1Password, disable _"Verify web browser code signature"_ via 

```
Help -> Advanced -> Verify web browser code signature
```

You have to download and install the [Browser-Add On/extension from AgileBits](https://agilebits.com/onepassword/extensions). Restart your browser and it should work.
And there you have it... running 1Password across OS X and Linux.


