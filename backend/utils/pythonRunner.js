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
        // Clean the output string
        const cleanedData = dataString
          .replace(/[\n\r]/g, '') // Remove newlines
          .replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '') // Remove BOM and whitespace
          .replace(/\s+/g, ' '); // Replace multiple spaces with single space

        // Parse the cleaned JSON
        const parsedData = JSON.parse(cleanedData);
        resolve(parsedData);
      } catch (error) {
        console.error('Raw output:', dataString);
        console.error('Parsing error:', error);
        reject(new Error(`Failed to parse Python output: ${error.message}`));
      }
    });
  });
}

module.exports = { runPythonProcess };