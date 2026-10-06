# assets

rokaru generates the startup logo itself each launch by running
`cli-ascii-logo "rokaru" -p cyberpunk --random` through a pty (for a fresh random
gradient every time). This folder is only the **fallback** used when that tool is
not installed.

The loader looks for, in order:

1. `assets/ascii-logo.ans`
2. `assets/ascii-logo.txt`

It understands ANSI colours (truecolor `38;2;r;g;b`, 256-colour `38;5;n`, and
basic/bright `3x`/`9x`); other escape sequences are stripped. If neither file
exists, a built-in block version of the logo is coloured with a random palette.

## Supplying the coloured art

Save the generator output to the file:

```sh
mkdir -p ~/dev/rokaru/assets
cli-ascii-logo "rokaru" -p cyberpunk --random > ~/dev/rokaru/assets/ascii-logo.txt
```

If the tool drops colours when output is redirected, capture through a pty so
the escape codes survive:

```sh
script -q /dev/null cli-ascii-logo "rokaru" -p cyberpunk --random > ~/dev/rokaru/assets/ascii-logo.txt
```
