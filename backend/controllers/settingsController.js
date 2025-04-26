const Settings = require('../models/Settings');

// Get public settings that don't require authentication
exports.getPublicSettings = async (req, res) => {
  try {
    // Get settings or create default if none exist
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        appName: 'Self-Assessment System'
      });
    }
    
    // Only return public-facing settings
    const publicSettings = {
      appName: settings.appName,
      faviconPath: settings.faviconPath,
      contactEmail: settings.contactEmail,
      supportPhone: settings.supportPhone
    };
    
    res.status(200).json(publicSettings);
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};