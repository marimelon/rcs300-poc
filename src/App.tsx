import { useFelica } from "./useFecica";
import { useFelica2 } from "./useFecica2";

var seqNumber = 0;

var sleep = async (msec: number) => {
  return new Promise((resolve) => setTimeout(resolve, msec));
};

var dataviewToArray = (argData: DataView) => {
  let retVal = new Array(argData.byteLength);
  for (let i = 0; i < argData.byteLength; ++i) {
    retVal[i] = argData.getUint8(i);
  }
  return retVal;
};

var addReqHeader = (argData: Uint8Array) => {
  const dataLen = argData.length;
  const SLOTNUMBER = 0x00;

  let retVal = new Uint8Array(10 + dataLen);

  retVal[0] = 0x6b; // ヘッダー作成
  retVal[1] = 255 & dataLen; // length をリトルエンディアン
  retVal[2] = (dataLen >> 8) & 255;
  retVal[3] = (dataLen >> 16) & 255;
  retVal[4] = (dataLen >> 24) & 255;
  retVal[5] = SLOTNUMBER; // タイムスロット番号
  retVal[6] = ++seqNumber; // 認識番号

  0 != dataLen && retVal.set(argData, 10); // コマンド追加

  return retVal;
};

var sendUSB = async (
  usbDevice: USBDevice,
  argData: Uint8Array,
  argProc = ""
) => {
  const rdData = await addReqHeader(argData);
  console.log(
    "sendUSB",
    argProc,
    rdData ? arrayToHex(new Uint8Array(rdData)) : undefined
  );
  await sleep(100);
  await usbDevice.transferOut(2, rdData);
};

var recvUSB = async (usbDevice: USBDevice, argLength: number) => {
  const res = await usbDevice.transferIn(2, argLength);
  console.log(
    "recvUSB",
    res.data ? arrayToHex(new Uint8Array(res.data.buffer)) : undefined
  );
  await sleep(100);
  return res;
};

var arrayToHex = (argData: Uint8Array) => {
  let retVal = "";
  let temp = [];
  for (let val of argData) {
    let str = val.toString(16);
    str = val < 0x10 ? "0" + str : str;
    retVal += str.toUpperCase() + " ";
  }
  return retVal;
};

var usbDeviceCommunicationThruEX = async (argCom: Uint8Array) => {
  // RC-S300 コマンド　communicateThruEX
  const communicateThruEX = [0xff, 0x50, 0x00, 0x01, 0x00];
  // RC-S300 コマンド　communicateThruEX フッター
  const communicateThruEXFooter = [0x00, 0x00, 0x00];
  // FeliCa リクエストヘッダー
  const felicaHeader = [0x5f, 0x46, 0x04];
  // FeliCa リクエストオプション
  const felicaOption = [0x95, 0x82];
  // タイムアウト(ms)
  let felicaTimeout = 100;

  // FeliCa Lite-S コマンドにレングスを付加
  let felicaComLen = argCom.length + 1;
  let felicaCom = [felicaComLen, ...argCom];
  console.log(felicaCom);

  // FeliCa Lite-S リクエストヘッダーを付加
  felicaTimeout *= 1e3; // マイクロ秒へ変換
  let felicaReq = [...felicaHeader]; // リクエストヘッダー
  felicaReq.push(
    255 & felicaTimeout,
    (felicaTimeout >> 8) & 255,
    (felicaTimeout >> 16) & 255,
    (felicaTimeout >> 24) & 255
  ); // タイムアウト <<リトルエンディアン>> 4バイト
  felicaReq.push(...felicaOption);
  felicaReq.push((felicaComLen >> 8) & 255, 255 & felicaComLen); // コマンドレングス
  felicaReq.push(...felicaCom); // リクエストコマンド

  // communicateThruEX コマンド作成
  let felicaReqLen = felicaReq.length;
  let cTX = [...communicateThruEX];
  cTX.push((felicaReqLen >> 8) & 255, 255 & felicaReqLen); // リクエストレングス
  cTX.push(...felicaReq);
  cTX.push(...communicateThruEXFooter);

  return new Uint8Array(cTX);
};

var usbDeviceCommunicationThruEXResponse = async (
  argRes: USBInTransferResult
) => {
  let data = dataviewToArray(argRes.data!);
  let retVal = { status: false } as any;
  // レスポンスデータ長の取得
  let v = data.indexOf(0x97); // レスポンスデータから 0x97 の位置を求める
  if (v >= 0) {
    let w = v + 1; // 0x97 の次にデータ長が設定されている。(128バイト以上は未考慮です)
    retVal.Length = data[w];
    if (retVal.Length > 0) {
      retVal.allData = data.slice(w + 1, w + retVal.Length + 1); // 全レスポンスデータ切り出す
      retVal.status = true;
      retVal.responseCode = retVal.allData[1]; // レスポンスコード
      retVal.data = retVal.allData.slice(2, retVal.allData.length + 1); // レスポンスデータ(レングス、レスポンスコードを除いたデータ)
    }
  }
  return retVal;
};

var felica2 = async (usbDevice: USBDevice) => {
  const systemCode = [0x86, 0xb3];
  // const systemCode = [0xFF, 0xFF]
  const command = Uint8Array.of(0x00, ...systemCode, 0x01, 0x00);
  const pollingCom = await usbDeviceCommunicationThruEX(command);
  //console.log( pollingCom ) ;
  await sendUSB(usbDevice, pollingCom, "Polling");
  let res;
  let resdata;
  await sleep(100);
  res = await recvUSB(usbDevice, 200);
  await sleep(100);
  // res = await recvUSB( usbDevice,64 ) ;
  console.log("res", res);
  resdata = await usbDeviceCommunicationThruEXResponse(res);

  console.log(resdata);
  if (resdata.status === true) {
    console.log("IDm", resdata.data.slice(0, 8));
  }
};

export default function App() {
  const { initDevice, getIDm, getStudentId } = useFelica();
  const {
    initDevice: initDevice2,
    getIDm: getIDm2,
    getStudentId: getStudentId2,
  } = useFelica2();

  const handleClick = async () => {
    //const filter = { vendorId: 0x054c };
    const filter = { vendorId: 1356 };
    const options = {
      filters: [filter],
    };
    // デバイスを開いてインターフェースに接続
    const device = await navigator.usb.requestDevice(options);
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(1);
    // RCS380オブジェクトにして返す
    console.log(device);

    const endTransparent = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x82, 0x00, 0x00,
    ]);
  };

  const handkeClick2 = async () => {
    const device = await initDevice();
    console.log(device);
    const idm = await getIDm(device);
    console.log(idm);
    const stId = await getStudentId(device, idm);
    console.log(stId);
  };

  const handkeClick3 = async () => {
    //const filter = { vendorId: 0x054c };
    const filter = { vendorId: 1356 };
    const options = {
      filters: [filter],
    };
    // デバイスを開いてインターフェースに接続
    const device = await navigator.usb.requestDevice(options);
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(1);
    // RCS380オブジェクトにして返す
    console.log(device);

    //コマンド
    const endTransparent = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x82, 0x00, 0x00,
    ]);
    const startransparent = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x81, 0x00, 0x00,
    ]);
    const turnOff = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00,
    ]);
    const turnOn = new Uint8Array([
      0xff, 0x50, 0x00, 0x00, 0x02, 0x84, 0x00, 0x00,
    ]);

    //EndTransparentSession
    await sendUSB(device, endTransparent, "End Transeparent Session");
    await recvUSB(device, 64);
    //StartTransparentSession
    await sendUSB(device, startransparent, "Start Transeparent Session");
    await recvUSB(device, 64);
    //TurnOffTheRF
    await sendUSB(device, turnOff, "Turn Off RF");
    await recvUSB(device, 64);
    //TurnOnTheRF
    await sendUSB(device, turnOn, "Turn On RF");
    await recvUSB(device, 64);
    //communicateThruEX
    //await felica(device);

    await felica2(device);
    //TurnOffTheRF
    await sendUSB(device, turnOff, "Turn Off RF");
    //EndTransparentSession
    await sendUSB(device, endTransparent, "End Transeparent Session");
    //USBDevice.close()
    device.close();
  };

  const handleClick4 = async () => {
    const device = await initDevice2();
    const idm = await getIDm2(device);
    console.log(idm);
    // 1, 20, 142, 19, 165, 31, 253, 4
  };

  const handleClick5 = async () => {
    const device = await initDevice();
    const idm = await getIDm(device);
    console.log(idm);
    const stid = await getStudentId(device, idm);
    console.log(stid);
    device.disconnect();
  };

  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <button onClick={handleClick}>ボタン</button>
      <button onClick={handkeClick2}>ボタン2</button>
      <button onClick={handkeClick3}>ボタン3</button>
      <button onClick={handleClick4}>ボタン4</button>
      <button onClick={handleClick5}>ボタン4</button>
    </div>
  );
}
