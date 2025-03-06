import Image from "next/image";

export interface TestamonialProps {
	user: {
		username: string;
		avatar: string;
	};
	text: string;
}

export const Testamonial = ({ user, text }: TestamonialProps) => {
	return (
		<div className="border p-4 text-xs flex flex-row gap-x-6 flex-grow">
			<Image
				src={user.avatar}
				alt={`${user.username}'s avatar`}
				className="w-8 h-8 saturate-0 object-cover"
				width={48}
				height={48}
			/>
			<div className="flex flex-col gap-y-1">
				<span className="text-polar-500">{`// ${user.username}`}</span>
				<p className="text-justify leading-normal">{text}</p>
			</div>
		</div>
	);
};
