
import Router from "next/router";

export default function AuthPage() {


  return (
    <>
      <div>
        <div>
          <button onClick={() => Router.push("/login")}>Login</button>
          <button onClick={() => Router.push("/signup")}>Sign Up</button>
        </div>
      </div>
    </>
  );
}
