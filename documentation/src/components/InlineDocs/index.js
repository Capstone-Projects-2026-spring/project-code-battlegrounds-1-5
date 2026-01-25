import React from "react";

/**
 * Displays generated HTML docs in an iframe.
 *
 * @param {{
 *   docFolder: string,
 *   width?: string,
 *   height?: string
 * }} props
 */
function InlineDocs({ docFolder, width = "100%", height = "600px" }) {
	const projectName = process.env.PROJECT_NAME || "docs-dev-mode"; // Fallback when local
	const iframeSrc = `/${projectName}/${docFolder}/index.html`; // Folder where your docs are. Relative to the static folder

	return (
		<div style={{ margin: "1em 0" }}>
			<a
				href={iframeSrc}
				target="_blank"
				style={{ display: "inline-block", marginBottom: "0.5em" }}
			>
				Click me for Full Screen
			</a>
			<iframe
				src={iframeSrc}
				width={width}
				height={height}
				title={docFolder}
				style={{
					border: "2px solid #ddd",
					borderRadius: "8px",
					boxShadow: "0 0 6px rgba(0,0,0,0.1)",
				}}
			/>
		</div>
	);
}

export default InlineDocs;
