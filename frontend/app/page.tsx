import UpgradeForm from "./upgradeForm";
export default function Home() {
  return (
    <main className="flex flex-col  items-center justify-center">
      <div className="flex items-center justify-center p-5 ">
        <div className="flex flex-col m-4 md:m-24 max-w-5xl">
          <h5 className="text-2xl  text-gray-950 text-center font-barlow">Upgrade your deprecated Starknet account</h5>
          <h4 className="text-1xl text-gray-950 text-center py-2 mb-5">
            ⚠️ This tool is a rare exception: it asks for your private key. If you prefer, you can upgrade with our
            command-line tool or run this page locally. Both are available in our{" "}
            <a href="https://github.com/argentlabs/upgrade-v0-account" className="text-blue-500">
              public repository
            </a>
            .
          </h4>
          <UpgradeForm />
        </div>
      </div>
    </main>
  );
}
