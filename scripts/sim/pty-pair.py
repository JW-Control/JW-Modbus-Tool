#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Par de puertos serie virtuales (como com0com) con dos pty de Linux.

  python3 pty-pair.py --link-a /dev/ttyUSB10 --link-b /dev/ttyUSB11 [--echo-a] [--echo-b]

Lo que se escribe en A se lee en B y al revés. --echo-a devuelve a A lo que
escribe (conversor con eco del lado A). Imprime las dos rutas en stdout.
"""
import argparse
import os
import select
import termios
import tty

parser = argparse.ArgumentParser()
parser.add_argument("--link-a", required=True)
parser.add_argument("--link-b", required=True)
parser.add_argument("--echo-a", action="store_true")
parser.add_argument("--echo-b", action="store_true")
args = parser.parse_args()


def make(link):
    master, slave = os.openpty()
    tty.setraw(slave)
    attrs = termios.tcgetattr(slave)
    attrs[3] &= ~termios.ECHO
    termios.tcsetattr(slave, termios.TCSANOW, attrs)
    try:
        os.unlink(link)
    except FileNotFoundError:
        pass
    os.symlink(os.ttyname(slave), link)
    return master, slave


a, _keep_a = make(args.link_a)
b, _keep_b = make(args.link_b)
print(args.link_a, args.link_b, flush=True)

while True:
    ready, _, _ = select.select([a, b], [], [])
    for src in ready:
        try:
            data = os.read(src, 4096)
        except OSError:
            continue
        if not data:
            continue
        dst = b if src == a else a
        os.write(dst, data)
        if (src == a and args.echo_a) or (src == b and args.echo_b):
            os.write(src, data)
