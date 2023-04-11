const Box = ({ children }) => (
  <div className=" w-full rounded-md bg-white p-5 shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)]">
    <form className="flex flex-col space-y-4">{children}</form>
  </div>
)

export default Box
