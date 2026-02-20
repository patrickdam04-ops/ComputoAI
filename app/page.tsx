import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ComputoApp from "./ComputoApp";

export default async function Home() {
  const authObject = await auth();
  if (!authObject.userId) {
    redirect("/sign-in");
  }

  return <ComputoApp />;
}
