const cron = require("node-cron");
const User = require("../models/Users");

cron.schedule("0 0 * * *", async () => {
    const expiredUsers = await User.find({ membershipExpiry: { $lt: new Date() } });
  
    expiredUsers.forEach(async (user) => {
      user.membership = "Free";
      user.membershipExpiry = null;
      await user.save();
    });
  
    console.log("Expired memberships downgraded");
  });
  