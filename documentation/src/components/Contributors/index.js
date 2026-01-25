import React, { useState } from 'react';
import styles from './styles.module.css';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function Contributors({ orgName, projectName: projectNameProp }) {
    const {siteConfig} = useDocusaurusContext();
    const {organizationName: orgNameConfig, projectName: projectNameConfig} = siteConfig;
    const [imageError, setImageError] = useState(false);

    const organizationName = orgName || orgNameConfig;
    const projectName = projectNameProp || projectNameConfig;

    const handleImageError = () => {
        setImageError(true);
    };

    const contributorsImageSrc = imageError
        ? 'https://via.placeholder.com/400x100/f0f0f0/666666?text=Contributors+Not+Available'
        : `https://contrib.rocks/image?repo=${organizationName}/${projectName}`;

    const linkHref = imageError
        ? 'tutorial/tutorial-basics/set-environment-variables'
        : `https://github.com/${organizationName}/${projectName}/graphs/contributors`;

    return <div className={styles.contributors}>
        <a href={linkHref}>
            <img
                src={contributorsImageSrc}
                alt={imageError ? 'Contributors image not available - click to learn how to set environment variables.' : 'Contributors'}
                onError={handleImageError}
            />
        </a>
        <p>Made with<a href={"https://contrib.rocks"}> contrib.rocks</a>.
        </p>
    </div>;
}
