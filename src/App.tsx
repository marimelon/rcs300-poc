import { useState } from "react";
import { useFelica } from "./useFecica";
import { useFelica2 } from "./useFecica2";

const sleep = (ms = 3000) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [status, setStatus] = useState("");

  const { initDevice, getIDm, getStudentId } = useFelica();
  const {
    initDevice: initDevice2,
    getIDm: getIDm2,
    getStudentId: getStudentId2,
  } = useFelica2();

  const handleRCS380 = async () => {
    const device = await initDevice2();

    while (true) {
      const idm = await getIDm2(device);
      if (idm.byteLength === 0) {
        await sleep(200);
        continue;
      }

      if (idm.byteLength !== 8) {
        console.log("IDmの読み取りに失敗しました");
        break;
      }

      const stid = await getStudentId2(device, idm);
      if (stid !== "") {
        alert(stid);
      } else {
        alert("読み取りに失敗しました");
      }

      break;
    }
  };

  const handleRCS300 = async () => {
    const device = await initDevice();

    while (true) {
      const idm = await getIDm(device);
      if (idm.byteLength === 0) {
        await sleep(1000);
        continue;
      }

      if (idm.byteLength !== 8) {
        console.log("IDmの読み取りに失敗しました");
        break;
      }

      const stid = await getStudentId(device, idm);
      if (stid !== "") {
        alert(stid);
      } else {
        alert("読み取りに失敗しました");
      }

      break;
    }
  };

  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>{status}</h2>
      <button
        onClick={async () => {
          try {
            setStatus("読み取り中");
            await handleRCS380();
          } catch (e) {
            setStatus("エラー");
            throw e;
          }
        }}
      >
        RCS380
      </button>
      <button
        onClick={async () => {
          try {
            setStatus("読み取り中");
            await handleRCS300();
            setStatus("");
          } catch (e) {
            setStatus("エラー");
            throw e;
          }
        }}
      >
        RCS300
      </button>
    </div>
  );
}
