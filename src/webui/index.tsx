/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import App from './App';
import { WasmInterface } from './RiscV';
import { fetchTestcases } from './EmulatorState';

const root = document.getElementById('root');

// SAFETY: wasmInterface is only accessed by App, which is called after
export let wasmInterface!: WasmInterface;

(async () => {
  let wi = WasmInterface.loadModule();
  let tc = fetchTestcases();
  wasmInterface = await wi;
  await tc;
  render(() => <App />, root!);
})();