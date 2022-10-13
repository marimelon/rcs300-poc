import { useState } from "react";
import { useFelica } from "./felica/useFelica";

const sleep = (ms = 3000) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [status, setStatus] = useState("");

  const { initDevice, getIDm, getStudentId, disConnect } = useFelica();

  const handleRead = async () => {
    await initDevice();

    while (true) {
      const idm = await getIDm();
      if (idm.byteLength === 0) {
        await sleep(100);
        continue;
      }

      if (idm.byteLength !== 8) {
        console.log("IDmの読み取りに失敗しました");
        break;
      }

      const stid = await getStudentId(idm);
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
      <h1>Read Felica</h1>
      <h2>{status}</h2>
      <button
        onClick={async () => {
          try {
            setStatus("読み取り中");
            await handleRead();
            setStatus("");
          } catch (e) {
            setStatus("エラー");
            throw e;
          }
        }}
      >
        読み込み
      </button>
      <button
        onClick={() => {
          disConnect();
        }}
      >
        リセット
      </button>
    </div>
  );
}
