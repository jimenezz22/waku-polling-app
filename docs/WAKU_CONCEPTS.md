## Waku Components We’ll Use

### **Light Node**

**What it is**: A lightweight Waku node that doesn’t require much bandwidth or processing power.
**What it’s for**: Connect to the Waku network without maintaining the full infrastructure. Perfect for web apps running in the browser.

### **Light Push Protocol**

**What it is**: Allows sending messages to the network without being permanently connected as a relay.
**What it’s for**:

* Publish new polls when someone creates them
* Send votes when a user selects an option
* Works great for users with intermittent connections

### **Filter Protocol**

**What it is**: Subscribe only to the messages you’re interested in, in real time.
**What it’s for**:

* Receive new polls created by other users
* Receive votes in real time to update counters
* Keep the app updated without downloading irrelevant messages

### **Store Protocol**

**What it is**: Retrieves historical messages that happened while you were offline.
**What it’s for**:

* Load existing polls when you first open the app
* Fetch all historical votes to calculate current results
* Sync with the latest state after being offline

### **Waku Identity**

**What it is**: A cryptographic key-based identity system unique to each user.
**What it’s for**:

* Uniquely identify each voter without exposing personal information
* Sign votes to prevent forgery
* Prevent duplicate votes in the same poll
* Preserve anonymity while ensuring cryptographic verification

### **Content Topics**

**What they are**: Specific channels where different types of messages are published.
**What they’re for**:

* `/decenvote/1/polls/proto` – Channel for new polls
* `/decenvote/1/votes/proto` – Channel for votes
* Organize messages by type instead of mixing everything together
