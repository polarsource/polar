import { ReactNode } from "react";

interface EmptyStateProps {
	icon: ReactNode;
	title: string;
	description: string;
}

export const EmptyState = ({ icon, title, description }: EmptyStateProps) => {
	return (
		<div className="dark:border-polar-700 flex flex-col items-center justify-center rounded-2xl border border-gray-200 p-12 gap-2">
			<div className="text-gray-500 dark:text-polar-500 text-5xl">{icon}</div>
			<div className="text-center flex flex-col items-center">
				<h3 className="text-lg text-gray-900 dark:text-polar-50">{title}</h3>
				<p className="text-gray-500 dark:text-polar-500">{description}</p>
			</div>
		</div>
	);
};
