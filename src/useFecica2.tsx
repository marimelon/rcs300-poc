import { RCS380 } from "rc_s380_driver";
import { useEffect, useState } from "react";

export const getDevice = async () => {
  const device = await RCS380.connect();
  await device.initDevice();

  const protocol = Uint8Array.of(0x00, 0x18);
  const rf = Uint8Array.of(0x01, 0x01, 0x0f, 0x01);
  await device.sendPreparationCommands(rf, protocol);
  return device;
};

export const getStudentId = async (device: RCS380) => {};

export const useFelica2 = () => {
  const [device, setDevice] = useState<RCS380>();

  useEffect(() => {
    return () => {
      if (device !== undefined) {
        device.disconnect();
      }
    };
  }, []);

  const initDevice = async () => {
    if (device !== undefined) {
      return device;
    }

    const _device = await RCS380.connect();
    await _device.initDevice();

    const protocol = Uint8Array.of(0x00, 0x18);
    const rf = Uint8Array.of(0x01, 0x01, 0x0f, 0x01);
    await _device.sendPreparationCommands(rf, protocol);
    setDevice(_device);
    return _device;
  };

  const getIDm = async (device: RCS380) => {
    if (device === undefined) {
      throw new Error("デバイスが初期化されていません");
    }

    // コマンドコード:0x00 システムコード: 0x86B3 リクエストコード:0x1 タイムスロット:0x0
    const systemCode = [0x86, 0xb3];
    const command = Uint8Array.of(0x00, ...systemCode, 0x01, 0x00);
    // const command = Uint8Array.of(0x00, 0xff, 0xff, 0x01, 0x00)
    const payload = Uint8Array.of(command.byteLength + 1, ...command);
    const result = await device.inCommRf(payload, 0.1);
    const idm = result.data.slice(9, 17);
    return idm;
  };

  const getStudentId = async (device: RCS380, idm: Uint8Array) => {
    if (device === undefined) {
      throw new Error("デバイスが初期化されていません");
    }

    const service_code = [0x12, 0x0b];
    const block_list_size = {
      byte3: 0b00000000,
      byte2: 0b10000000,
    };
    const block_list_access_mode = {
      unuse_parse_service: 0b00000000,
      use_parse_service: 0b00010000,
    };
    const createBlockListElement = ({
      block_number,
    }: {
      block_number: number;
    }) => {
      return [
        block_list_size.byte2 |
          block_list_access_mode.unuse_parse_service |
          0b00000000,
        block_number,
      ];
    };
    const blocks = [0].map((_) => createBlockListElement({ block_number: _ }));

    const command = Uint8Array.of(
      0x06, //コマンドコード
      ...idm, // IDm
      0x01, // サービス数
      ...[...service_code].reverse(), //サービスコードリスト
      blocks.length,
      ...blocks.flat() //ブロックリスト
    );
    const payload = Uint8Array.of(command.byteLength + 1, ...command);
    const result = await device.inCommRf(payload, 0.01);
    const decoder = new TextDecoder();
    var stId = "";
    for (var i = 20; i < result.data.length; i++) {
      if (result.data[i] === 0x20) {
        stId = decoder.decode(result.data.slice(20, i));
        break;
      }
    }
    return stId;
  };

  return { initDevice, getIDm, getStudentId };
};
