import "./utils";

abstract class Packet {
  protected constructor(readonly payload: Uint8Array) {}

  get header(): Uint8Array {
    return this.payload.slice(0, 10);
  }

  get footer(): Uint8Array {
    return this.payload.slice(-2);
  }
}

abstract class RCS300Packet extends Packet {
  protected constructor(readonly payload: Uint8Array) {
    super(payload);
  }

  get dataLengthAsBytes(): Uint8Array {
    return this.payload.slice(2, 6);
  }

  get dataLength(): number {
    // Bufferを作っておく
    const buffer = new ArrayBuffer(2);
    // 8bytesごとに書き込む
    const octedView = new Uint8Array(buffer);
    octedView[0] = this.payload[5];
    octedView[1] = this.payload[6];
    // それを16bytesとして読む
    const view = new Uint16Array(buffer);
    return view[0];
  }

  get data(): Uint8Array {
    return this.payload.slice(10, 10 + this.dataLength);
  }
}

export class AckPacket extends Packet {
  constructor() {
    const ackPacket = Uint8Array.of(0x00, 0x00, 0xff, 0x00, 0xff, 0x00);
    super(ackPacket);
  }
}

export class SendPacket extends RCS300Packet {
  constructor(data: Uint8Array, seqNumber: number) {
    const header = Uint8Array.of(0x6b);
    const dataLength_ = data.byteLength.asLittleEndian();

    const dataLength = Uint8Array.of(
      255 & data.byteLength,
      (data.byteLength >> 8) & 255,
      (data.byteLength >> 16) & 255,
      (data.byteLength >> 24) & 255
    );

    const slotNumber = 0x00;
    const footer = Uint8Array.of(0x0, 0x0, 0x0);
    const payload = Uint8Array.of(
      ...header,
      ...dataLength,
      slotNumber,
      seqNumber,
      ...footer,
      ...data
    );

    super(payload);
  }
}

export class ReceivedPacket extends RCS300Packet {
  constructor(payload: Uint8Array) {
    super(payload);
  }
}

export class SuccessPacket extends ReceivedPacket {
  constructor(payload: Uint8Array) {
    super(payload);
  }
}

export class FailurePacket extends ReceivedPacket {
  constructor(payload: Uint8Array) {
    super(payload);
  }
}

export class FelicaReceivedPacket extends ReceivedPacket {
  constructor(payload: Uint8Array) {
    super(payload);
  }

  get felicaData(): Uint8Array {
    let v = this.data.indexOf(0x97);
    if (v >= 0 && this.data[v + 1] > 0) {
      const length = this.data[v + 1];
      if (length > 0) {
        return this.data.slice(v + 2, v + 2 + length);
      }
    }
    return new Uint8Array();
  }
}
