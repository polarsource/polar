const Box = ({ children }) => (
  <div className=" w-full rounded-xl bg-white p-5 shadow">
    <form className="flex flex-col space-y-4">{children}</form>
  </div>
)

export default Box
