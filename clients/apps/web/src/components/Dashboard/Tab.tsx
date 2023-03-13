const Tab = (props: { active: boolean; children: any }) => {
  return (
    <div
      className={
        'cursor-pointer rounded-md py-1 px-3 text-sm transition-all duration-100 ' +
        (props.active
          ? 'bg-white text-black drop-shadow '
          : 'bg-transparent text-black/50 hover:bg-white/50 hover:text-black/80')
      }
    >
      {props.children}
    </div>
  )
}
export default Tab
