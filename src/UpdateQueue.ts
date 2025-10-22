import { GraphManager, Node, Link } from './GraphManager';

interface QueuedUpdate {
  nodes: Node[];
  links: Link[];
}

/**
 * UpdateQueue - Batches graph updates to prevent rapid D3 recreation
 * Collects nodes/links and flushes them periodically
 */
export class UpdateQueue {
  private graphManager: GraphManager;
  private batchInterval: number;
  private timer: NodeJS.Timeout | null = null;

  private nodeQueue: Node[] = [];
  private linkQueue: Link[] = [];

  constructor(graphManager: GraphManager, batchInterval: number = 500) {
    this.graphManager = graphManager;
    this.batchInterval = batchInterval;
  }

  /**
   * Add nodes to the queue
   */
  queueNodes(nodes: Node[]) {
    this.nodeQueue.push(...nodes);
    this.scheduleFlush();
  }

  /**
   * Add links to the queue
   */
  queueLinks(links: Link[]) {
    this.linkQueue.push(...links);
    this.scheduleFlush();
  }

  /**
   * Add both nodes and links together
   */
  queueUpdate(nodes: Node[], links: Link[]) {
    this.nodeQueue.push(...nodes);
    this.linkQueue.push(...links);
    this.scheduleFlush();
  }

  /**
   * Schedule a flush if not already scheduled
   */
  private scheduleFlush() {
    if (this.timer) return; // Already scheduled

    this.timer = setTimeout(() => {
      this.flush();
    }, this.batchInterval);
  }

  /**
   * Flush queued updates to the graph manager
   */
  flush() {
    if (this.nodeQueue.length > 0) {
      this.graphManager.addNodes(this.nodeQueue);
      this.nodeQueue = [];
    }

    if (this.linkQueue.length > 0) {
      this.graphManager.addLinks(this.linkQueue);
      this.linkQueue = [];
    }

    this.timer = null;
  }

  /**
   * Force immediate flush
   */
  forceFlush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }

  /**
   * Clear the queue without flushing
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nodeQueue = [];
    this.linkQueue = [];
  }

  /**
   * Get queue size
   */
  getQueueSize() {
    return {
      nodes: this.nodeQueue.length,
      links: this.linkQueue.length,
    };
  }

  /**
   * Set batch interval
   */
  setBatchInterval(interval: number) {
    this.batchInterval = interval;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clear();
  }
}
