import UpgradeForm from "./upgradeForm";
import Image from "next/image";
export default function Home() {
  return (
    <main className="flex flex-col  items-center justify-center">
      <div className="flex items-center justify-center p-5 ">
        <div className="drop-shadow-2xl w-80">
          <Image alt="Argent Logo" src="/deprecated-account.png" width={350} height={300} />
          <p className="text-xs text-gray-700 text-center m-w-45 mt-2">
            {" "}
            If you have a deprecated account like this one, this tool will help you to upgrade it to the latest version
          </p>
        </div>
        <div className="flex flex-col m-24 max-w-2xl">
          <h5 className="text-2xl  text-gray-950 text-center font-barlow">
            Upgrade your deprecated account to the latest one
          </h5>
          <h4 className="text-1xl font-bold text-gray-950 text-center py-2 mb-5">
            ⚠️ This is a rare exception that we ask you for your private key. As an alternative, you can also upgrade
            with this open-source tool directly
          </h4>
          <UpgradeForm />
        </div>
      </div>
    </main>
  );
}
