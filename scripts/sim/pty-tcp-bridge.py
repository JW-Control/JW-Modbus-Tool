#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Puerto serie virtual (pty de Linux) unido a un bus RS-485 de JWPLC Sim.

Hace de "conversor USB-RS485" entre JW Modbus Tool y
`node cli/jwsim-bus.mjs <sketch> --tcp <puerto>` (RTU crudo por TCP).

  python3 pty-tcp-bridge.py --tcp 15020 [--echo] [--link /tmp/jwsim-com]

Con --echo imita un conversor que no apaga su receptor mientras transmite:
todo lo que el Tool escribe vuelve por el mismo puerto antes de la respuesta.
Imprime la ruta del pty en la primera línea de stdout.
"""
import argparse
import os
import select
import socket
import sys
import termios
import tty

parser = argparse.ArgumentParser()
parser.add_argument("--tcp", type=int, required=True)
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--echo", action="store_true")
parser.add_argument("--link", default=None)
args = parser.parse_args()

master, slave = os.openpty()
tty.setraw(slave)
attrs = termios.tcgetattr(slave)
attrs[3] &= ~termios.ECHO
termios.tcsetattr(slave, termios.TCSANOW, attrs)
path = os.ttyname(slave)
if args.link:
    try:
        os.unlink(args.link)
    except FileNotFoundError:
        pass
    os.symlink(path, args.link)

sock = socket.create_connection((args.host, args.tcp))
print(args.link or path, flush=True)

try:
    while True:
        ready, _, _ = select.select([master, sock], [], [])
        if master in ready:
            try:
                data = os.read(master, 4096)
            except OSError:
                data = b""
            if data:
                sock.sendall(data)
                if args.echo:
                    os.write(master, data)
        if sock in ready:
            data = sock.recv(4096)
            if not data:
                break
            os.write(master, data)
except KeyboardInterrupt:
    pass
finally:
    sys.stdout.flush()
