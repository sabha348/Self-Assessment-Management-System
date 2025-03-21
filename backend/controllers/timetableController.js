const Timetable = require("../models/Timetable");

// Create Timetable Entry
exports.createEntry = async (req, res) => {
  const { day, subjectName, startTime, endTime } = req.body;

  if (!day || !subjectName || !startTime || !endTime) {
    return res.status(400).json({ 
      error: "Invalid request. Please provide day, subject name, start time, and end time." 
    });
  }

  try {
    // Check for time slot conflict
    const conflictingEntry = await Timetable.findOne({
      user: req.user.userId,
      day,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    if (conflictingEntry) {
      return res.status(400).json({ 
        error: "Time slot conflict. This time slot overlaps with an existing entry." 
      });
    }

    const timetable = new Timetable({ 
      user: req.user.userId, 
      day, 
      subjectName,
      startTime,
      endTime
    });
    
    await timetable.save();
    res.status(201).json(timetable);
  } catch (err) {
    console.error("Error creating entry:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Timetable Entries
exports.getEntries = async (req, res) => {
  try {
    const timetables = await Timetable.find({ user: req.user.userId })
      .sort({ day: 1, startTime: 1 }); // Sort by day and start time
    res.json(timetables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Entries by Day
exports.getEntriesByDay = async (req, res) => {
  const { day } = req.params;
  try {
    const timetables = await Timetable.find({ 
      user: req.user.userId,
      day 
    }).sort({ startTime: 1 });
    res.json(timetables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Entry
exports.updateEntry = async (req, res) => {
  const { id } = req.params;
  const { subjectName, startTime, endTime, isFinished } = req.body;

  try {
    const timetable = await Timetable.findOne({ 
      _id: id,
      user: req.user.userId 
    });

    if (!timetable) {
      return res.status(404).json({ error: "Timetable entry not found." });
    }

    // Check for time slot conflict if time is being updated
    if (startTime && endTime) {
      const conflictingEntry = await Timetable.findOne({
        user: req.user.userId,
        day: timetable.day,
        _id: { $ne: id }, // Exclude current entry
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          }
        ]
      });

      if (conflictingEntry) {
        return res.status(400).json({ 
          error: "Time slot conflict. This time slot overlaps with an existing entry." 
        });
      }
    }

    // Update only provided fields
    if (subjectName) timetable.subjectName = subjectName;
    if (startTime) timetable.startTime = startTime;
    if (endTime) timetable.endTime = endTime;
    if (typeof isFinished !== 'undefined') timetable.isFinished = isFinished;

    await timetable.save();
    res.json(timetable);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Entry
exports.deleteEntry = async (req, res) => {
  const { id } = req.params;

  try {
    const timetable = await Timetable.findOneAndDelete({ 
      _id: id,
      user: req.user.userId 
    });

    if (!timetable) {
      return res.status(404).json({ error: "Timetable entry not found." });
    }

    res.json({ message: "Entry deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
