const Timetable = require("../models/Timetable");

// Create Timetable Entry
exports.createEntry = async (req, res) => {
  // console.log("Received Request Body:", req.body);
  // console.log("User ID from Token:", req.user);

  const { day, subjects } = req.body;

  if (!day || !subjects || subjects.length === 0) {
    return res.status(400).json({ error: "Invalid request. Please provide day and subjects." });
  }

  try {
    const timetable = new Timetable({ user: req.user.userId, day, subjects });
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
    const timetables = await Timetable.find({ user: req.user.userId });
    res.json(timetables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Timetable Entry
exports.updateEntry = async (req, res) => {
  const { day, subjects } = req.body;

  try {
    const timetable = await Timetable.findOne({ user: req.user.userId, day });

    if (!timetable) {
      return res.status(404).json({ error: "Timetable entry not found." });
    }

    timetable.subjects = subjects;
    await timetable.save();

    res.json(timetable);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Update subject 

exports.updateSubject = async (req, res) => {
  const { day, subjectId, updatedSubject } = req.body;

  try {
    const timetable = await Timetable.findOne({ user: req.user.userId, day });

    if (!timetable) {
      return res.status(404).json({ error: "Timetable entry not found." });
    }

    // Find the subject to update
    const subjectIndex = timetable.subjects.findIndex((sub) => sub._id.toString() === subjectId);
    if (subjectIndex === -1) {
      return res.status(404).json({ error: "Subject not found." });
    }

    // Update the subject
    timetable.subjects[subjectIndex] = { ...timetable.subjects[subjectIndex]._doc, ...updatedSubject };
    await timetable.save();

    res.json({ message: "Subject updated successfully", timetable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Delete Subject 
exports.deleteSubject = async (req, res) => {
  const { day, subjectId } = req.body;

  try {
    const timetable = await Timetable.findOne({ user: req.user.userId, day });

    if (!timetable) {
      return res.status(404).json({ error: "Timetable entry not found." });
    }

    // Filter out the subject to delete
    timetable.subjects = timetable.subjects.filter((sub) => sub._id.toString() !== subjectId);

    // If no subjects are left, delete the whole day entry
    if (timetable.subjects.length === 0) {
      await Timetable.findByIdAndDelete(timetable._id);
    } else {
      await timetable.save();
    }

    res.json({ message: "Subject deleted successfully", timetable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
