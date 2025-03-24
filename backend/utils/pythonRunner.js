const { spawn } = require("child_process");

function sanitizeText(text) {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

function sanitizeArgs(args) {
  return args.map(arg => {
    if (Array.isArray(arg)) {
      // Ensure array is properly stringified without line breaks
      return JSON.stringify(arg).replace(/\n/g, ' ');
    }
    if (typeof arg === 'string') {
      // Clean string arguments
      return sanitizeText(arg);
    }
    return arg.toString();
  });
}

function runPythonProcess(scriptPath, args) {
  return new Promise((resolve, reject) => {
    console.log('Running Python script:', scriptPath);
    console.log('Raw arguments:', args);
    const pythonProcess = spawn('python', [scriptPath, ...args]);
    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process failed with code ${code}: ${errorString}`));
        return;
      }

      try {
        // Decode if base64 encoded
        const jsonStr = Buffer.from(dataString.trim(), 'base64').toString();
        const parsedData = JSON.parse(jsonStr);
        resolve(parsedData);
      } catch (baseError) {
        console.warn("Base64 decode failed, trying direct parse:", baseError.message);
        try {
          // Try to sanitize before parsing as a last resort
          const sanitized = dataString.trim()
            .replace(/[\r\n]+/g, ' ')
            .replace(/\\n/g, ' ')
            .replace(/\\/g, '\\\\')
            .replace(/\t/g, ' ');
            
          const parsedData = JSON.parse(sanitized);
          resolve(parsedData);
        } catch (error) {
          console.error("All parsing attempts failed:", error.message);
          console.error("Raw data (first 200 chars):", dataString.substring(0, 200));
          reject(new Error(`Failed to parse output: ${error.message}`));
        }
      }
    });
  });
}

module.exports = { runPythonProcess };