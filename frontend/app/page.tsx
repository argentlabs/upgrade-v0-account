import UpgradeForm from "./upgradeForm";
export default function Home() {
  return (
    <main className="flex flex-col  items-center justify-center">
      <div className="flex items-center justify-center p-5 ">
        <div className="flex flex-col m-24 max-w-5xl">
          <h5 className="text-2xl  text-gray-950 text-center font-barlow">Upgrade your deprecated account</h5>
          <h4 className="text-1xl text-gray-950 text-center py-2 mb-5">
            ⚠️ This is a rare exception that we provide a tool that asks for your private key. As an alternative you can
            upgrade with our command-line tool or run this webapp locally. Everything is available{" "}
            <a href="https://github.com/argentlabs/upgrade-v0-account" className="text-blue-500">
              here
            </a>{" "}
            on our public git repo.
          </h4>
          <UpgradeForm />
        </div>
      </div>
    </main>
  );
}
