import {
  AckPacket,
  FelicaReceivedPacket,
  ReceivedPacket,
  SendPacket,
} from "./RCS300Packet";

export class RCS300 {
  static readonly vendorId = 0x054c; // SONY
  static readonly productId1 = 0xdc8; // SONY PaSoRi RC-S300/S
  static readonly productId2 = 0xdc9; // SONY PaSoRi RC-S300/P
  static readonly interfaceNum = 1;
  static readonly endpointNumber = 2;

  private maxReceiveSize = 290;

  private frameWaitingTime = 2.474516;
  private deltaFrameWaitingTime = 49152 / 13.56e6;
  // デフォルトのタイムアウト時間
  public timeout = this.frameWaitingTime + this.deltaFrameWaitingTime;

  public seqNumber = 0;

  public constructor(readonly device: USBDevice) {}

  public static async connect(): Promise<RCS300> {
    // RC-S300を特定
    const options: USBDeviceRequestOptions = {
      filters: [
        { vendorId: RCS300.vendorId, productId: RCS300.productId1 },
        { vendorId: RCS300.vendorId, productId: RCS300.productId2 },
      ],
    };
    // デバイスを開いてインターフェースに接続
    const device = await navigator.usb.requestDevice(options);
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(this.interfaceNum);

    return new RCS300(device);
  }

  private async write(packet: AckPacket | SendPacket) {
    console.debug(">>>>> send >>>>>");
    console.debug(packet.payload);

    try {
      await this.device.transferOut(RCS300.endpointNumber, packet.payload);
    } catch (e) {
      console.error(e);
    }
  }

  private async read(): Promise<ReceivedPacket> {
    // 結果を取得
    const result = await this.device.transferIn(2, this.maxReceiveSize);
    // 入っているパケットをUint8Arrayに変換
    const rawPacket =
      result.data !== undefined
        ? new Uint8Array(result.data.buffer)
        : Uint8Array.of(0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00);

    console.debug("<<<<< receive <<<<<");
    console.debug(rawPacket);

    return new ReceivedPacket(rawPacket);
  }

  private parseTimeout(timeoutMs: number): Uint8Array {
    // タイムアウト秒数(ms)をリトルエンディアン(4byte)に変換
    const hexTimeout = (Math.floor(timeoutMs * 1000) + 1) * 10; // マイクロ秒へ変換
    return Uint8Array.of(
      255 & hexTimeout,
      (hexTimeout >> 8) & 255,
      (hexTimeout >> 16) & 255,
      (hexTimeout >> 24) & 255
    );
  }

  private async sendCommandAndReceiveResult(
    rawCommand: Uint8Array
  ): Promise<ReceivedPacket> {
    const packet = new SendPacket(rawCommand, ++this.seqNumber);
    await this.write(packet);
    return this.read();
  }

  public async endTransparentSession() {
    // トランスペアレントセッションの終了
    const endTransparent = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x82, 0x00, 0x00,
    ]);

    return await this.sendCommandAndReceiveResult(endTransparent);
  }

  public async startTransparentSession() {
    // トランスペアレントセッションの開始
    const startransparent = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x81, 0x00, 0x00,
    ]);

    return await this.sendCommandAndReceiveResult(startransparent);
  }

  public async turnOffRf() {
    // RFのソフトパワーダウン
    const turnOff = Uint8Array.of(
      0xff,
      0x50,
      0x00,
      0x00,
      0x02,
      0x83,
      0x00,
      0x00
    );

    return await this.sendCommandAndReceiveResult(turnOff);
  }

  public async turnOnRf() {
    // RFのソフトパワーアップ
    const turnOn = Uint8Array.of(
      0xff,
      0x50,
      0x00,
      0x00,
      0x02,
      0x84,
      0x00,
      0x00
    );

    return await this.sendCommandAndReceiveResult(turnOn);
  }

  public async communicateThruEX(command: Uint8Array) {
    const communicateThruEX = Uint8Array.of(0xff, 0x50, 0x00, 0x01, 0x00);
    const commandLength = Uint8Array.of(
      (command.byteLength >> 8) & 255,
      255 & command.byteLength
    );
    const communicateThruEXFooter = Uint8Array.of(0x00, 0x00, 0x00);

    return await this.sendCommandAndReceiveResult(
      Uint8Array.of(
        ...communicateThruEX,
        ...commandLength,
        ...command,
        ...communicateThruEXFooter
      )
    );
  }

  public async sendFelicaCommand(data: Uint8Array, timeoutMs: number) {
    const timeout = this.parseTimeout(timeoutMs);
    const felicaHeader = Uint8Array.of(0x5f, 0x46, 0x04);
    const commandLength = Uint8Array.of(
      (data.byteLength >> 8) & 255,
      255 & data.byteLength
    );
    const felicaFooter = Uint8Array.of(0x95, 0x82);

    const response = await this.communicateThruEX(
      Uint8Array.of(
        ...felicaHeader,
        ...timeout,
        ...felicaFooter,
        ...commandLength,
        ...data
      )
    );
    return new FelicaReceivedPacket(response.payload);
  }

  public async initDevice() {
    console.info("Initialize RC-S300");
    await this.endTransparentSession();
    await this.startTransparentSession();
    await this.turnOffRf();
    await this.turnOnRf();
  }

  public async disconnect() {
    console.info("Disconnect RC-S300");
    await this.turnOffRf();
    await this.endTransparentSession();
    await this.device.releaseInterface(RCS300.interfaceNum);
    await this.device.close();
  }
}
