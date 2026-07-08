# JWPLC Remote I/O Preset

The first bundled preset is:

`JWPLC Remote I/O Slave RTU - PoC 1`

## Default serial configuration

- Mode: Master RTU
- Slave ID: 2
- Baudrate: 115200
- Data bits: 8
- Parity: None
- Stop bits: 1
- Timeout: 1000 ms
- Retries: 1

## Map

- FC2, start 0, quantity 8: `I0_0` through `I0_7`
- FC1, start 0, quantity 8: feedback `Q0_0` through `Q0_7`
- FC5, address 0 through 7: individual output control
- FC15, start 0, quantity 8: block output control

## Planned validation sequence

1. Read inputs with FC2 start 0 quantity 8.
2. Write `Q0_0` ON with FC5.
3. Read output feedback with FC1.
4. Write `Q0_0` OFF with FC5.
5. Write pattern `0x55` with FC15.
6. Read output feedback with FC1.
7. Write pattern `0x00` with FC15.
8. Read output feedback with FC1.
9. Generate PASS/FAIL summary.

The UI and report exporter are deferred until the protocol and serial layers are
stable.
