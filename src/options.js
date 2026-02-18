document.getElementById('save').addEventListener('click', () => {
    const awsKey = document.getElementById('awsKey').value;
    const awsSecret = document.getElementById('awsSecret').value;

    chrome.storage.local.set({
        awsCreds: { accessKeyId: awsKey, secretAccessKey: awsSecret }
    }, () => {
        document.getElementById('status').innerText = 'Saved securely!';
        // Trigger an immediate fetch in background
        chrome.runtime.sendMessage({ action: "FORCE_REFRESH" });
    });
});
