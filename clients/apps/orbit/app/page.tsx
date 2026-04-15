import { CircularBand } from "./components/CircularBand";
import { SolarBurst } from "./components/SolarBurst";
import { WaveSphere } from "./components/WaveSphere";
import { OrganicSpiral } from "./components/OrganicSpiral";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-black py-24">
      <main className="w-full max-w-5xl px-8">
        <div className="grid grid-cols-2 gap-12">
          <CircularBand />
          <SolarBurst />
          <WaveSphere />
          <OrganicSpiral />
        </div>
      </main>
    </div>
  );
}
