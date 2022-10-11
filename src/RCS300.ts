import { AckPacket, FailurePacket, FelicaReceivedPacket, ReceivedPacket, SendPacket, SuccessPacket } from './RCS300Packet'

var arrayToHex = ( argData:Uint8Array ) => {
  let retVal = '' ;
  let temp = [] ;
  for ( let val of argData ) {
    let str = val.toString(16) ;
    str = val < 0x10 ? '0' + str : str ;
    retVal += str.toUpperCase() + ' ' ;
  }
  return retVal ;
}

export class RCS300 {
  private ackPacket = new AckPacket()
  static readonly interfaceNum = 1;
  private maxReceiveSize = 290
  readonly defaultProtocol = Uint8Array.of(
    0x00,
    0x18,
    0x01,
    0x01,
    0x02,
    0x01,
    0x03,
    0x00,
    0x04,
    0x00,
    0x05,
    0x00,
    0x06,
    0x00,
    0x07,
    0x08,
    0x08,
    0x00,
    0x09,
    0x00,
    0x0a,
    0x00,
    0x0b,
    0x00,
    0x0c,
    0x00,
    0x0e,
    0x04,
    0x0f,
    0x00,
    0x10,
    0x00,
    0x11,
    0x00,
    0x12,
    0x00,
    0x13,
    0x06
  )
  private frameWaitingTime = 2.474516
  private deltaFrameWaitingTime = 49152 / 13.56e6
  // デフォルトのタイムアウト時間
  public timeout = this.frameWaitingTime + this.deltaFrameWaitingTime

  public seqNumber = 0

  private constructor(
    readonly device: USBDevice
  ) {}

  public static async connect(): Promise<RCS300> {
    // ベンダーIDでRC-S380を特定
    const filter: USBDeviceFilter = {vendorId: 0x054c}
    const options: USBDeviceRequestOptions = {
      filters: [filter]
    }
    // デバイスを開いてインターフェースに接続
    const device = await navigator.usb.requestDevice(options)
    await device.open()
    await device.selectConfiguration(1)
    await device.claimInterface(this.interfaceNum)
    // RCS380オブジェクトにして返す
    return new RCS300(device)
  }

  private async write(packet: AckPacket | SendPacket) {
    console.debug('>>>>> send >>>>>')
    console.debug(packet.payload,arrayToHex(packet.payload))

    try {
      await this.device.transferOut(2, packet.payload)
    } catch (e) {
      console.error(e)
    }
  }

  private async read(): Promise<ReceivedPacket> {
    // 結果を取得
    const result = await this.device.transferIn(2, this.maxReceiveSize)
    // 入っているパケットをUint8Arrayに変換
    const rawPacket = (result.data !== undefined)
      ? new Uint8Array(result.data.buffer)
      : Uint8Array.of(0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00)

    console.debug('<<<<< receive <<<<<')
    console.debug(rawPacket,arrayToHex(rawPacket))

    return new ReceivedPacket(rawPacket)
  }

  private parseTimeout(timeoutMs: number): Uint8Array {
    // タイムアウト指定パケット組み立て用バッファの確保(2bytes)
    // const buffer = new ArrayBuffer(4)
    // // 指定された計算式に従ってタイムアウト秒数を整数化
    const hexTimeout = (Math.floor(timeoutMs * 1000) + 1) * 10
    // // リトルエンディアンでタイムアウト秒数を書き込む
    // const view = new DataView(buffer)
    // view.setUint32(0, hexTimeout, true)
    // return new Uint8Array(buffer)
    return Uint8Array.of(255 & hexTimeout, hexTimeout >> 8 & 255, hexTimeout >> 16 & 255, hexTimeout >> 24 & 255)
  }

  private async sendCommandAndReceiveResult(rawCommand: Uint8Array): Promise<ReceivedPacket> {
    const packet = new SendPacket(rawCommand,++this.seqNumber)
    await this.write(packet)
    return this.read()
  }

  private async sendAck() {
    await this.write(this.ackPacket)
  }

  public async endTransparentSession(){
    const endTransparent = new Uint8Array( [ 0xFF, 0x50, 0x00, 0x00, 0x02, 0x82, 0x00, 0x00 ] ) ;
    return await this.sendCommandAndReceiveResult(endTransparent)
  }

  public async startTransparentSession(){
    const startransparent = new Uint8Array( [ 0xFF, 0x50, 0x00, 0x00, 0x02, 0x81, 0x00, 0x00 ] ) ;
    return await this.sendCommandAndReceiveResult(startransparent)
  }

  public async turnOffRf(){
    const turnOff = new Uint8Array( [ 0xFF, 0x50, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00 ] ) ;
    return await this.sendCommandAndReceiveResult(turnOff)
  }

  public async turnOnRf(){
    const turnOn  = new Uint8Array( [ 0xFF, 0x50, 0x00, 0x00, 0x02, 0x84, 0x00, 0x00 ] ) ;
    return await this.sendCommandAndReceiveResult(turnOn)
  }

  public async communicateThruEX(command:Uint8Array){
    const communicateThruEX = Uint8Array.of(0xFF, 0x50, 0x00, 0x01, 0x00) ;
    const commandLength =   Uint8Array.of( command.byteLength >> 8 & 255, 255 & command.byteLength)
    const communicateThruEXFooter = Uint8Array.of( 0x00, 0x00, 0x00 ) ;
    return await this.sendCommandAndReceiveResult(Uint8Array.of(...communicateThruEX,...commandLength,...command,...communicateThruEXFooter))
  }

  public async sendFelicaCommand(data:Uint8Array,timeoutMs: number){
    const timeout = this.parseTimeout(timeoutMs)
    const felicaHeader = Uint8Array.of( 0x5F, 0x46, 0x04 ) ;
    const commandLength =   Uint8Array.of( data.byteLength >> 8 & 255, 255 & data.byteLength)
    const felicaFooter = Uint8Array.of( 0x95, 0x82 ) ;
   const response = await this.communicateThruEX(Uint8Array.of(...felicaHeader,...timeout,...felicaFooter,...commandLength,...data))
    return new FelicaReceivedPacket(response.payload)
  }

  public async initDevice() {
    console.info('Initialize RC-S300')
    await this.endTransparentSession()
    await this.startTransparentSession()
    await this.turnOffRf()
    await this.turnOnRf()
  }

  public async disconnect() {
    console.info('Disconnect RC-S300')
    await this.turnOffRf()
    await this.endTransparentSession()

    await this.device.releaseInterface( RCS300.interfaceNum) ;
    await this.device.close() ;
  }
}