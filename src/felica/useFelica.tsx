import { useCallback, useEffect, useRef } from "react";
import { FelicaReader } from "./FelicaReader";
import { RCS300 } from "./rcs300/RCS300";
import { RCS380 } from "./rcs380/RCS380";

const connectUsb = async () => {
  const options: USBDeviceRequestOptions = {
    filters: [
      { vendorId: RCS300.vendorId, productId: RCS300.productId_P },
      { vendorId: RCS300.vendorId, productId: RCS300.productId_S },
      { vendorId: RCS380.vendorId, productId: RCS380.productId_P },
      { vendorId: RCS380.vendorId, productId: RCS380.productId_S },
    ],
  };

  // デバイスを開いてインターフェースに接続
  const device = await navigator.usb.requestDevice(options);
  await device.open();
  await device.selectConfiguration(1);

  if (
    device.productId === RCS300.productId_S ||
    device.productId === RCS300.productId_P
  ) {
    await device.claimInterface(RCS300.interfaceNum);
  } else if (
    device.productId === RCS380.productId_S ||
    device.productId === RCS380.productId_P
  ) {
    await device.claimInterface(RCS380.interfaceNum);
  }

  return device;
};

export const useFelica = () => {
  const deviceRef = useRef<FelicaReader>();

  useEffect(() => {
    return () => {
      disConnect();
    };
  }, []);

  const initDevice = useCallback(async () => {
    if (deviceRef.current !== undefined) {
      return deviceRef.current;
    }
    const usbDevice = await connectUsb();
    console.debug(usbDevice);

    if (
      usbDevice.productId === RCS300.productId_S ||
      usbDevice.productId === RCS300.productId_P
    ) {
      // RCS300
      const device: FelicaReader = new RCS300(usbDevice);
      await device.initDevice();
      console.debug("useFelica: initDevice end");
      deviceRef.current = device;
      return device;
    } else if (
      usbDevice.productId === RCS380.productId_S ||
      usbDevice.productId === RCS380.productId_P
    ) {
      // RCS380
      const device: FelicaReader = new RCS380(usbDevice);
      await device.initDevice();
      console.debug("useFelica: initDevice end");
      deviceRef.current = device;
      return device;
    }
    throw new Error("不明なUSBデバイス");
  }, []);

  const disConnect = useCallback(async () => {
    if (deviceRef.current !== undefined) {
      const device = deviceRef.current;
      deviceRef.current = undefined;
      device.disconnect();
    }
  }, []);

  const getIDm = useCallback(async () => {
    if (deviceRef.current === undefined) {
      throw new Error("デバイスが初期化されていません");
    }
    const device = deviceRef.current;

    // システムコード: 0x86B3 リクエストコード:0x1 タイムスロット:0x0
    const systemCode = [0x86, 0xb3];
    const result = await device.felicaPolling(
      { systemCode: systemCode, requestCode: 1, timeSlot: 0 },
      1
    );
    const idm = result.felicaData.slice(2, 10);
    return idm;
  }, []);

  const getStudentId = useCallback(async (idm: Uint8Array) => {
    if (deviceRef.current === undefined) {
      throw new Error("デバイスが初期化されていません");
    }
    const device = deviceRef.current;

    const service_code = [0x12, 0x0b];

    const result = await device.felicaReadWithoutEncryption({
      idm: idm,
      serviceCodeList: [service_code],
      blockSizeList: [2],
      blockListAccessMode: "unuse",
    });
    const data = result.felicaData;

    const decoder = new TextDecoder();
    var stId = "";
    for (var i = 13; i < data.length; i++) {
      if (data[i] === 0x20) {
        stId = decoder.decode(data.slice(13, i));
        break;
      }
    }
    return stId;
  }, []);

  return { initDevice, disConnect, getIDm, getStudentId };
};
