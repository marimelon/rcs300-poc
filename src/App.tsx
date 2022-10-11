import { useFelica } from "./useFecica";
import { useFelica2 } from "./useFecica2";

export default function App() {
  const { initDevice, getIDm, getStudentId } = useFelica();
  const {
    initDevice: initDevice2,
    getIDm: getIDm2,
    getStudentId: getStudentId2,
  } = useFelica2();

  const handleRCS380 = async () => {
    const device = await initDevice2();
    const idm = await getIDm2(device);
    console.log(idm);
    const stid = await getStudentId2(device, idm);
    console.log(stid);
  };

  const handleRCS300 = async () => {
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
      <button onClick={handleRCS380}>RCS380</button>
      <button onClick={handleRCS300}>RCS300</button>
    </div>
  );
}
