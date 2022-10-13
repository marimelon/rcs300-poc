const createBlockListElement = (
  blockNumber: number,
  blockListSize: 2 | 3,
  blockListAccessMode: "use" | "unuse"
) => {
  return [
    (blockListSize === 2 ? 0b10000000 : 0b00000000) |
      (blockListAccessMode === "use" ? 0b00010000 : 0b00000000) |
      0b00000000,
    blockNumber,
  ];
};

export abstract class FelicaReader {
  constructor(readonly device: USBDevice) {}
  abstract initDevice(): Promise<void>;
  abstract disconnect(): Promise<void>;
  // Felicaコマンドを送信する. 先頭にコマンド長が必要
  abstract sendFelicaCommand(
    data: Uint8Array,
    timeoutMs: number
  ): Promise<FelicaReceivedPacket>;

  public async felicaPolling(
    request: FelicaPollingRequestCommand,
    timeoutMs: number = 1
  ) {
    const command = Uint8Array.of(
      0x00, //コマンドコード
      ...request.systemCode,
      request.requestCode,
      request.timeSlot
    );
    const payload = Uint8Array.of(command.byteLength + 1, ...command);
    return await this.sendFelicaCommand(payload, timeoutMs);
  }

  public async felicaReadWithoutEncryption(
    request: FelicaReadWithoutEncryptionRequestCommand,
    timeoutMs: number = 1
  ) {
    const blocks = request.blockSizeList.map((size, index) =>
      createBlockListElement(index, size, request.blockListAccessMode)
    );
    const serviceCodeList = request.serviceCodeList.flatMap((e) => e.reverse());

    const command = Uint8Array.of(
      0x06, //コマンドコード
      ...request.idm, // IDm
      request.serviceCodeList.length, // サービス数
      ...serviceCodeList, //サービスコードリスト
      blocks.length,
      ...blocks.flat() //ブロックリスト
    );
    const payload = Uint8Array.of(command.byteLength + 1, ...command);
    return await this.sendFelicaCommand(payload, timeoutMs);
  }
}

export abstract class FelicaReceivedPacket {
  abstract get felicaData(): Uint8Array;
}

export type FelicaPollingRequestCommand = {
  systemCode: number[];
  requestCode: number;
  timeSlot: number;
};

export type FelicaReadWithoutEncryptionRequestCommand = {
  idm: Uint8Array;
  serviceCodeList: number[][];
  blockSizeList: (2 | 3)[]; // ブロックサイズの配列
  blockListAccessMode: "use" | "unuse";
};
