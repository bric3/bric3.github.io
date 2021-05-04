#!/usr/bin/env sh

[ -e /Applications/Inkscape.app/Contents/MacOS/inkscape ] || (echo "inkscape isn't installed"; exit 1)

# inkscape 1.0.x
#   inkscape -z -w 1024 -h 1024 input.svg -e output.png
#
# inkscape 1.0.x
#   inkscape -w 1024 -h 1024 input.svg -o output.png

# To confuse things somewhat, Microsoft recommends that to cover a wide range of devices, use an image 1.8 times the standard tile size so the image can be scaled up or down as needed.
# https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/samples/dn455106(v=vs.85)
#
# This would result in the following browserconfig.xml which references tile images which have been scaled by 1.8
inkscape -w 270 -h 270 favicon-optimized.svg -o mstile-150x150.png
inkscape -w 558 -h 558 favicon-optimized.svg -o mstile-310x310.png

inkscape -w 180 -h 180 favicon-optimized.svg -o apple-touch-icon.png
inkscape -w 57 -h 57 favicon-optimized.svg -o apple-touch-icon-57x57.png
inkscape -w 60 -h 60 favicon-optimized.svg -o apple-touch-icon-60x60.png
inkscape -w 72 -h 72 favicon-optimized.svg -o apple-touch-icon-72x72.png
inkscape -w 76 -h 76 favicon-optimized.svg -o apple-touch-icon-76x76.png
inkscape -w 114 -h 114 favicon-optimized.svg -o apple-touch-icon-114x114.png
inkscape -w 120 -h 120 favicon-optimized.svg -o apple-touch-icon-120x120.png
inkscape -w 144 -h 144 favicon-optimized.svg -o apple-touch-icon-144x144.png
inkscape -w 152 -h 152 favicon-optimized.svg -o apple-touch-icon-152x152.png
inkscape -w 180 -h 180 favicon-optimized.svg -o apple-touch-icon-180x180.png

inkscape -w 192 -h 192 favicon-optimized.svg -o android-chrome-192.png
inkscape -w 512 -h 512 favicon-optimized.svg -o android-chrome-512.png

inkscape -w 32 -h 32 favicon-optimized.svg -o favicon-16x16.png
inkscape -w 32 -h 32 favicon-optimized.svg -o favicon-32x32.png