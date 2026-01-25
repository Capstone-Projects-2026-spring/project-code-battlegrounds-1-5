import React, {useEffect, useState} from 'react';

export default function RevisionHistory(props) {
    const [history, setHistory] = useState(null)
    const [error, setError] = useState(null)

    useEffect(()=>{
        console.log(props);
        if (history == null){
            var myHeaders = new Headers();
            myHeaders.append("Accept", "application/json");
            // myHeaders.append("Authorization", `Bearer ${api_key}`);

            var requestOptions = {
                method: 'GET',
                headers: myHeaders,
                redirect: 'follow',
            };

            fetch(`https://api.github.com/repos/${process.env.ORG_NAME}/${process.env.PROJECT_NAME}/commits?path=documentation/`+location.pathname.substring(location.pathname.lastIndexOf('docs/'))+".md", requestOptions)
                .then(response => response.json())
                .then(result => {
                    console.log(result)
                    // Check if result is an array (successful API response) or an error object (rate limit/other error)
                    if (Array.isArray(result)) {
                        setHistory(result)
                        setError(null)
                    } else {
                        // Handle API errors (including rate limiting)
                        console.warn('GitHub API error:', result)
                        setHistory([]) // Set empty array to prevent map error
                        setError(result.message || 'Unable to load revision history')
                    }
                })
                .catch(error => {
                    console.log('error', error)
                    setHistory([]) // Set empty array to prevent map error
                    setError('Unable to load revision history due to network error')
                });
        }
    },[history]);
    // const {siteConfig} = useDocusaurusContext();
    return <>
        <details>
            <summary>
                Revision History
            </summary>
        <table>
            <thead>
            <tr>
            <th scope="row">
                Author
            </th>
            <th scope="row">
                Revision
            </th>
                <th scope="row">
                Date
            </th>
            </tr>
            </thead>
            <tbody>
            {error ? (
                <tr>
                    <td colSpan="3" style={{textAlign: 'center', fontStyle: 'italic', color: '#666'}}>
                        {error}
                    </td>
                </tr>
            ) : history != null && history.length > 0 ? history.map((hist)=>{
                return <>
                <tr>
                    <th scope="row">
                    {hist.commit.author.name}
                    </th>
                    <td>
                        <a href={`https://github.com/${process.env.ORG_NAME}/${process.env.PROJECT_NAME}/commit/${hist.sha}`}>

                        {hist.commit.message}
                        </a>
                    </td>
                    <td>
                        {`${new Date(hist.commit.author.date).toLocaleString()}`}
                    </td>
                </tr>
                </>
            }) : (
                <tr>
                    <td colSpan="3" style={{textAlign: 'center', fontStyle: 'italic', color: '#666'}}>
                        {history === null ? 'Loading...' : 'No revision history available'}
                    </td>
                </tr>
            )
            }
        </tbody>
        </table>
        </details>
    </>
}
