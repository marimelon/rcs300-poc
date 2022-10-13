import { FelicaReader } from "../FelicaReader";
import {
  AckPacket,
  FelicaReceivedPacket,
  ReceivedPacket,
  SendPacket,
} from "./RCS300Packet";

const START_TRANSPARENT_SESSION_TAG = 129;
const END_TRANSPARENT_SESSION_TAG = 130;
const TURN_OFF_THE_RF_TAG = 131;
const TURN_ON_THE_RF_TAG = 132;
const TRANSMISSION_AND_RECEPTION_FLAG_TAG = 144;
const TRANSMISSION_BIT_FRAMING_TAG = 145;
const RECEPTION_BIT_FRAMING = 146;
const TRANMIT_TAG = 147;
const RECEIVE_TAG = 148;
const TRANSCEIVE_TAG = 149;
const RESPONSE_STATUS_TAG = 150;
const RESPONSE_DATA_TAG = 151;
const SWITCH_PROTOCOL_TAG = 143;

const sleep = async (e: number) => {
  return new Promise((r, t) => {
    setTimeout(r, e);
  });
};

export class RCS300 extends FelicaReader {
  static readonly vendorId = 0x054c; // SONY
  static readonly productId_S = 0xdc8; // SONY PaSoRi RC-S300/S
  static readonly productId_P = 0xdc9; // SONY PaSoRi RC-S300/P
  static readonly interfaceNum = 1;
  static readonly endpointNumber = 2;

  private maxReceiveSize = 290;

  private frameWaitingTime = 2.474516;
  private deltaFrameWaitingTime = 49152 / 13.56e6;
  // デフォルトのタイムアウト時間
  public timeout = this.frameWaitingTime + this.deltaFrameWaitingTime;

  public seqNumber = 0;

  public constructor(readonly device: USBDevice) {
    super(device);
  }

  public static async connect(): Promise<RCS300> {
    // RC-S300を特定
    const options: USBDeviceRequestOptions = {
      filters: [
        { vendorId: RCS300.vendorId, productId: RCS300.productId_S },
        { vendorId: RCS300.vendorId, productId: RCS300.productId_P },
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

  private async sendCommand(
    command: Uint8Array,
    params: Uint8Array = new Uint8Array()
  ) {
    const commandHeader = [0xff, 0x50, 0x00, 0x00];
    const length = command.length;

    const payload = Uint8Array.of(
      ...commandHeader,
      length,
      ...command,
      0x0,
      ...params
    );
    return await this.sendCommandAndReceiveResult(payload);
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
    return await this.sendCommand(
      Uint8Array.of(END_TRANSPARENT_SESSION_TAG, 0x0)
    );
  }

  public async startTransparentSession() {
    // トランスペアレントセッションの開始
    return await this.sendCommand(
      Uint8Array.of(START_TRANSPARENT_SESSION_TAG, 0x0)
    );
  }

  public async turnOffRf() {
    // RFのソフトパワーダウン
    const res = await this.sendCommand(Uint8Array.of(TURN_OFF_THE_RF_TAG, 0x0));
    await sleep(30);
    return res;
  }

  public async turnOnRf() {
    // RFのソフトパワーアップ
    const res = await this.sendCommand(Uint8Array.of(TURN_ON_THE_RF_TAG, 0x0));
    await sleep(30);
    return res;
  }

  public async switchProtocolTypeF() {
    return await this.sendCommandAndReceiveResult(
      Uint8Array.of(0xff, 0x50, 0x00, 0x02, 0x04, 0x8f, 0x02, 0x03, 0x00, 0x00)
    );
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

    await this.switchProtocolTypeF();
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
