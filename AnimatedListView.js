
/**
 * AnimatedListView class
 * A class that provides an animated list view
 */
class AnimatedListView {
    // Private fields
    #container;             // Container to display the list view
    #items = [];            // Array to store list items
    #itemHeight;            // Height of an item
    #animationQueue;        // Animation queue
    #isSelectable = false;  // Flag to indicate if items are selectable
    #selectionChangedCallback; // Callback when selection state changes

    /**
     * Constructor
     * @param {string} containerId ID of the container to display the list view
     */
    constructor(containerId, isSelectable = false, selectionChangedCallback = null) {
        // Get the container element
        this.#container = document.getElementById(containerId);
        if (!this.#container) {
            throw new Error(`Container with ID '${containerId}' not found.`);
        }

        // Set the flag for whether items are selectable
        this.#isSelectable = isSelectable;

        // Set the callback for when the selection state changes
        this.#selectionChangedCallback = selectionChangedCallback;

        // Set the style of the container
        this.#container.classList.add('listview-container');

        // Measure the height of an item
        // Create and insert an empty row
        let item = AnimatedListView.#createEmptyRow();
        this.#container.appendChild(item);
        // Get the height
        this.#itemHeight = item.offsetHeight;
        // Remove the empty row
        this.#container.removeChild(item);

        // Initialize the animation queue
        this.#animationQueue = new AnimatedListView.#TicketQueue();
    }

    /**
     * Add the specified element to the end of the list
     * @param {HTMLElement} element The element to add
     * @returns {Promise} A promise that resolves when the animation is complete
     */
    async add(element) {
        // Create an item
        const item = this.#createItem(element);

        // Update the item list
        this.#items.push(item);

        // Join the queue and wait for your turn
        const ticket = this.#animationQueue.join();
        await this.#animationQueue.waitForMyTurn(ticket);

        // Add the new element to the list
        item.node.classList.add('appearing');
        this.#container.appendChild(item.node);

        // Get the animation duration
        var animationDuration = AnimatedListView.#getAnimationDuration(item.node);

        // Wait for the animation to complete
        return new Promise(resolve => {
            setTimeout(() => {
                // End the animation
                item.node.classList.remove('appearing');
                // Leave the queue
                this.#animationQueue.leave(ticket);
                // Resolve
                resolve();
            }, animationDuration);
        });
    }

    /**
     * Add multiple elements to the end of the list with a single animation
     * @param {HTMLElement[]} elements The array of elements to add
     * @returns {Promise} A promise that resolves when the animation is complete
     */
    async addMultiple(elements) {
        if (elements.length === 0) {
            return Promise.resolve(); // No elements to add
        }

        // Create items for all elements
        const items = elements.map(element => this.#createItem(element));

        // Update the item list
        this.#items.push(...items);

        // Join the queue and wait for your turn
        const ticket = this.#animationQueue.join();
        await this.#animationQueue.waitForMyTurn(ticket);

        // Create a document fragment to batch DOM updates
        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            item.node.classList.add('appearing');
            fragment.appendChild(item.node);
        });

        // Add all items to the container at once
        this.#container.appendChild(fragment);

        // Get the animation duration (assume all items have the same duration)
        const animationDuration = AnimatedListView.#getAnimationDuration(items[0].node);

        // Wait for the animation to complete
        return new Promise(resolve => {
            setTimeout(() => {
                // End the animation for all items
                items.forEach(item => item.node.classList.remove('appearing'));
                // Leave the queue
                this.#animationQueue.leave(ticket);
                // Resolve
                resolve();
            }, animationDuration);
        });
    }

    /**
     * Insert the specified element at the specified position
     * @param {HTMLElement} element The element to insert
     * @param {number} position The position to insert at
     * @returns {Promise} A promise that resolves when the animation is complete
     */
    async insert(element, position) {
        // Restrict the position to the valid range
        position = Math.max(0, Math.min(position, this.#items.length));

        // If the position is at the end, delegate to add
        if (position >= this.#items.length) {
            return this.add(element);
        }

        // Create an item
        const item = this.#createItem(element);

        // Get the element at the insertion position
        const refElement = this.#items[position].node;

        // Update the item list
        this.#items.splice(position, 0, item);

        // Join the queue and wait for your turn
        const ticket = this.#animationQueue.join();
        await this.#animationQueue.waitForMyTurn(ticket);

        // Create a placeholder element
        const placeholderListItem = AnimatedListView.#createEmptyRow();
        placeholderListItem.classList.add('row-expanding');
        placeholderListItem.style.height = '0px';

        // Add the placeholder element at the insertion position
        this.#container.insertBefore(placeholderListItem, refElement);

        // Wait for the DOM to update
        await new Promise(resolve => {
            requestAnimationFrame(() => resolve());
        });

        // Get the transition duration
        var durationTransition = AnimatedListView.#getTransitionDuration(placeholderListItem);

        // Set the height of the placeholder element and start the transition
        placeholderListItem.style.height = this.#itemHeight + 'px';

        // Wait for the transition to complete
        await new Promise(resolve => {
            setTimeout(resolve, durationTransition);
        });

        // Replace the placeholder element with the actual element
        item.node.classList.add('appearing');
        this.#container.replaceChild(item.node, placeholderListItem);

        // Get the animation duration
        var durationAnimation = AnimatedListView.#getAnimationDuration(item.node);

        // Wait for the animation to complete
        return new Promise(resolve => {
            setTimeout(() => {
                // End the animation
                item.node.classList.remove('appearing');
                // Leave the queue
                this.#animationQueue.leave(ticket);
                // Resolve
                resolve();
            }, durationAnimation);
        });
    }

    /**
     * Remove the element at the specified position
     * @param {number} position The position of the element to remove
     * @returns {Promise} A promise that resolves when the animation is complete
     */
    async remove(position) {
        // Restrict the position to the valid range
        position = Math.max(0, Math.min(position, this.#items.length - 1));

        // Get the element to remove
        const itemToRemove = this.#items[position].node;
        const itemHeight = itemToRemove.offsetHeight;

        // Update the item list
        this.#items.splice(position, 1);

        // Join the queue and wait for your turn
        const ticket = this.#animationQueue.join();
        await this.#animationQueue.waitForMyTurn(ticket);

        // Fade out the element
        itemToRemove.classList.add('disappearing');

        // Get the animation duration
        var animationDuration = AnimatedListView.#getAnimationDuration(itemToRemove);

        // Wait for the fade-out to complete
        await new Promise(resolve => {
            setTimeout(resolve, animationDuration);
        });

        // Replace the element to be removed with a placeholder element
        const placeholderListItem = AnimatedListView.#createEmptyRow();
        placeholderListItem.classList.add('row-collapsing');
        placeholderListItem.style.height = itemHeight + 'px';
        this.#container.replaceChild(placeholderListItem, itemToRemove);

        // Wait for the DOM to update
        await new Promise(resolve => {
            requestAnimationFrame(() => resolve());
        });

        // Get the transition duration
        var durationTransition = AnimatedListView.#getTransitionDuration(placeholderListItem);

        // Set the height of the placeholder element to 0 and start the transition
        placeholderListItem.style.height = '0px';

        // Wait for the transition to complete
        await new Promise(resolve => {
            setTimeout(resolve, durationTransition);
        });

        // Remove the placeholder element
        this.#container.removeChild(placeholderListItem);

        // Leave the queue
        this.#animationQueue.leave(ticket);

        return Promise.resolve();
    }

    /**
     * Move the element from one position to another
     * @param {number} fromPosition The position to move from
     * @param {number} toPosition The position to move to
     * @returns {Promise} A promise that resolves when the animation is complete
     */
    async move(fromPosition, toPosition) {
        // Restrict the positions to the valid range
        fromPosition = Math.max(0, Math.min(fromPosition, this.#items.length - 1));
        toPosition = Math.max(0, Math.min(toPosition, this.#items.length - 1));

        // If the source and destination positions are the same, do nothing
        if (fromPosition === toPosition) {
            return Promise.resolve();
        }

        // Backup the item list in the current order
        // This is for performing animations after updating the list
        let itemsBackup = this.#items.slice();

        // Update the item list
        if (fromPosition < toPosition) {
            // If from < to, remove first and then insert
            this.#items.splice(toPosition, 0, this.#items.splice(fromPosition, 1)[0]);
        } else {
            // If to < from, adjust the insertion position and then remove
            const item = this.#items.splice(fromPosition, 1)[0];
            this.#items.splice(toPosition, 0, item);
        }

        // Join the queue and wait for your turn
        const ticket = this.#animationQueue.join();
        await this.#animationQueue.waitForMyTurn(ticket);

        // To prevent the list from jittering due to transition discrepancies,
        // move the elements in the target range to a temporary container,
        // perform animations within the container, and then move them back to their original positions.

        // Calculate the range of the target area
        var rangeBegin = Math.min(fromPosition, toPosition);
        var rangeEnd = Math.max(fromPosition, toPosition);

        // Get the element to move
        const itemToMove = itemsBackup[fromPosition].node;
        const itemHeight = itemToMove.offsetHeight;

        // Get the first element in the target range
        const refElement = itemsBackup[rangeBegin].node;

        // Create a temporary container and insert it at the beginning of the target range
        const fixedContainer = document.createElement('div');
        fixedContainer.classList.add('fixed-container');
        this.#container.insertBefore(fixedContainer, refElement);

        // Move elements to the temporary container
        let totalHeight = 0; // Total height
        for (let i = rangeBegin; i <= rangeEnd; i++) {
            const item = itemsBackup[i].node;
            // Calculate the height and add it to the total
            totalHeight += item.offsetHeight;
            // Move the item to the temporary container
            this.#container.removeChild(item);
            fixedContainer.appendChild(item);
        }

        // Set the height of the temporary container
        fixedContainer.style.height = `${totalHeight}px`;

        // Apply the extraction animation to the element to move
        itemToMove.classList.add('extracted');

        // Get the animation duration
        var animationDuration = AnimatedListView.#getAnimationDuration(itemToMove);

        // Wait for the animation to complete
        await new Promise(resolve => {
            setTimeout(resolve, animationDuration);
        });

        // End the animation
        itemToMove.classList.remove('extracted');

        var placeholderFrom = AnimatedListView.#createEmptyRow();
        placeholderFrom.classList.add('row-collapsing');
        placeholderFrom.style.height = itemHeight + 'px';
        var placeholderTo = AnimatedListView.#createEmptyRow();
        placeholderTo.classList.add('row-expanding');
        placeholderTo.style.height = '0px';

        // Replace the source element with a placeholder element
        fixedContainer.replaceChild(placeholderFrom, itemToMove);

        // Calculate the position within the fixedContainer for the destination
        let insertPosition;
        if (fromPosition < toPosition) {
            // If from < to, adjust the insertion position by one
            insertPosition = toPosition - rangeBegin + 1;
        } else {
            // If to < from, calculate directly
            insertPosition = toPosition - rangeBegin;
        }

        // Insert the placeholder element at the destination
        fixedContainer.insertBefore(placeholderTo, fixedContainer.children[insertPosition]);

        // Wait for the DOM to update
        await new Promise(resolve => {
            requestAnimationFrame(() => resolve());
        });

        // Get the transition duration
        var durationTransition = AnimatedListView.#getTransitionDuration(placeholderTo);

        // Set the height of the placeholder elements and start the transition
        placeholderTo.style.height = itemHeight + 'px';
        placeholderFrom.style.height = '0px';

        // Wait for the transition to complete
        await new Promise(resolve => {
            setTimeout(resolve, durationTransition);
        });

        // Replace the destination placeholder element with the actual element
        fixedContainer.replaceChild(itemToMove, placeholderTo);
        itemToMove.classList.add('inserting');

        // Remove the source placeholder element
        fixedContainer.removeChild(placeholderFrom);

        // Get the animation duration
        var durationAnimation = AnimatedListView.#getAnimationDuration(itemToMove);

        // Wait for the animation to complete
        await new Promise(resolve => {
            setTimeout(resolve, durationAnimation);
        });

        // End the animation
        itemToMove.classList.remove('inserting');

        // Remove the contents from the temporary container
        while (fixedContainer.firstChild) {
            // Remove the child element and insert it before the temporary container
            const item = fixedContainer.firstChild;
            fixedContainer.removeChild(item);
            this.#container.insertBefore(item, fixedContainer);
        }

        // Remove the temporary container
        this.#container.removeChild(fixedContainer);

        // Leave the queue
        this.#animationQueue.leave(ticket);

        return Promise.resolve();
    }

    /**
     * Get the element at the specified position
     * @param {number} position The position of the element to get
     * @returns {HTMLElement|null} The element, or null if the position is invalid
     */
    getElement(position) {
        if (position >= 0 && position < this.#items.length) {
            return this.#items[position].content;
        }
        return null;
    }

    /**
     * Get the number of items in the list
     * @returns {number} The number of items in the list
     */
    getCount() {
        return this.#items.length;
    }

    /**
     * Utility function to get the animation duration
     * @param {HTMLElement} element The element to get the animation duration for
     * @returns {number} The animation duration in milliseconds
     */
    static #getAnimationDuration(element) {
        return parseFloat(getComputedStyle(element).animationDuration) * 1000;
    }

    /**
     * Utility function to get the transition duration
     * @param {HTMLElement} element The element to get the transition duration for
     * @returns {number} The transition duration in milliseconds
     */
    static #getTransitionDuration(element) {
        return parseFloat(getComputedStyle(element).transitionDuration) * 1000;
    }

    /**
     * Utility function to create a placeholder element
     * @param {HTMLElement} node The content of the placeholder element
     * @returns {HTMLElement} The created placeholder element
     */
    #createListItem(node) {
        // Create a div element
        const listItem = document.createElement('div');

        // Add the list item class
        listItem.classList.add('listview-item');

        // Add the content of the list item
        listItem.appendChild(node);

        // If selectable, add a click event
        if (this.#isSelectable) {
            listItem.onclick = () => { // Handle the click event
                // Add the selected state to itself, remove the selected state from other elements
                this.#items.forEach(item => {
                    if (item.node === listItem) {
                        item.node.classList.add('selected');
                    } else {
                        item.node.classList.remove('selected');
                    }
                });

                // Call the callback when the selection state changes
                if (this.#selectionChangedCallback) {
                    this.#selectionChangedCallback(listItem);
                }
            };
        }

        return listItem;
    }

    /**
     * Utility function to create a list item
     * @param {HTMLElement} node The content of the list item
     * @returns {Object} The created list item object
     */
    #createItem(node){
        return {
            content: node,
            node: this.#createListItem(node)
        };
    }

    /**
     * Utility function to create an empty row
     * @returns {HTMLElement} The created empty row element
     */
    static #createEmptyRow() {
        const item = document.createElement('div');
        item.classList.add('listview-item');
        item.classList.add('empty-row');
        return item;
    }

    /**
     * Utility function to create a text element with side padding
     * @param {string} text The text content
     * @param {number} padding The size of the side padding
     * @returns {HTMLElement} The created text element
     */
    static createTextItemWithSidePadding(text, padding = 0) {
        const node = document.createElement('div');
        node.textContent = text;
        node.style.padding = `0 ${padding}px`;
        return node;
    }
    
    /**
     * Inner class: TicketQueue
     * A class that implements a ticket-based waiting queue
     * - Join the queue and get a ticket (join)
     * - Check if it's your turn (isMyTurn)
     * - Return the ticket and leave the queue (leave)
     * - Wait asynchronously until it's your turn (waitForMyTurn)
     */
    static #TicketQueue = class {
        #queue;         // Array to store tickets
        #ticketCounter; // Counter to generate ticket numbers
        #waiters;       // Manage waiting promises (ticket -> resolver)

        /**
         * Constructor
         */
        constructor() {
            this.#queue = []; // Array to store tickets
            this.#ticketCounter = 0; // Counter to generate ticket numbers
            this.#waiters = new Map(); // Manage waiting promises (ticket -> resolver)
        }

        /**
         * Join the queue and get a ticket
         * @returns {number} The ticket number
         */
        join() {
            // Generate a ticket number
            const ticket = this.#ticketCounter++;
            // Add the ticket to the queue
            this.#queue.push(ticket);
            return ticket;
        }

        /**
         * Check if it's your turn
         * @param {number} ticket The ticket number
         * @returns {boolean} Whether it's your turn
         */
        isMyTurn(ticket) {
            if (this.#queue.length === 0) {
                return false;
            }
            return this.#queue[0] === ticket;
        }

        /**
         * Return the ticket and leave the queue
         * @param {number} ticket The ticket number
         * @returns {number} The ticket number that left the queue
         */
        leave(ticket) {
            if (this.#queue.length === 0) {
                throw new Error("Queue is empty");
            }
            if (this.#queue[0] !== ticket) {
                throw new Error("Ticket does not match the front of the queue");
            }
            // Remove the ticket at the front
            const removedTicket = this.#queue.shift();

            // Notify the next waiter
            if (this.#queue.length > 0) {
                // Get the next ticket at the front
                const nextTicket = this.#queue[0];
                // If the next ticket has a waiting promise, resolve it
                const resolver = this.#waiters.get(nextTicket);
                if (resolver) {
                    resolver(nextTicket);
                    this.#waiters.delete(nextTicket);
                }
            }
            return removedTicket;
        }

        /**
         * Wait asynchronously until it's your turn
         * @param {number} ticket The ticket number
         * @returns {Promise<number>} The ticket number when it's your turn
         */
        async waitForMyTurn(ticket) {
            if (this.isMyTurn(ticket)) {
                return ticket; // If already at the front, resolve immediately
            }

            // Create a promise and register it in the waiting list
            return new Promise(resolve => {
                this.#waiters.set(ticket, resolve);
            });
        }
    };
}
