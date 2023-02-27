const IconCounter = (props: { icon: string, count: number }) => {
    return (<>
        <div className="inline-flex gap-1 items-center">
            <span className="text-lg">{props.icon}</span>
            <span className="text-gray-400">{props.count}</span>
        </div>
    </>
    )
}

export default IconCounter
