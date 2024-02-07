import UpgradeForm from "./upgradeForm";
import Image from "next/image";
export default function Home() {
  return (
    <main className="h-screen flex flex-col lg:flex-row items-center justify-center">
      <Image alt="Argent Logo" src="/argent-logo-colour.png" width={500} height={500} />
      <UpgradeForm />
    </main>
  );
}
