'use client';

import { useEffect, useRef, useMemo } from 'react';
import { AgentMessage } from '@/types/agent';

interface AgentFlowCanvasProps {
  messages: AgentMessage[];
  running: boolean;
  className?: string;
}

interface FlowNode {
  id: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'result';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlowConnection {
  from: string;
  to: string;
}

const NODE_COLORS: Record<FlowNode['type'], { bg: string; border: string; text: string }> = {
  user: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  assistant: { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce' },
  tool_use: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  tool_result: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  system: { bg: '#f1f5f9', border: '#64748b', text: '#334155' },
  result: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

const NODE_ICONS: Record<FlowNode['type'], string> = {
  user: '👤',
  assistant: '🤖',
  tool_use: '🔧',
  tool_result: '✅',
  system: '⚙️',
  result: '🎯',
};

/**
 * AgentFlowCanvas - Visualizes agent execution as a flow diagram
 * Shows the conversation flow with nodes for each message type
 */
export function AgentFlowCanvas({ messages, running, className = '' }: AgentFlowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert messages to flow nodes
  const { nodes, connections } = useMemo(() => {
    const flowNodes: FlowNode[] = [];
    const flowConnections: FlowConnection[] = [];
    
    const nodeWidth = 180;
    const nodeHeight = 60;
    const horizontalGap = 40;
    const verticalGap = 30;
    const startX = 20;
    const startY = 20;
    
    let currentX = startX;
    let currentY = startY;
    let maxY = startY;
    let lastNodeId: string | null = null;
    
    // Group consecutive tool_use and tool_result nodes horizontally
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      
      // Check if this is a tool_use followed by tool_result (group them)
      if (msg.type === 'tool_use' && messages[i + 1]?.type === 'tool_result') {
        // Place tool_use
        const toolUseNode: FlowNode = {
          id: msg.id,
          type: 'tool_use',
          label: msg.toolName || 'Tool',
          x: currentX,
          y: currentY,
          width: nodeWidth,
          height: nodeHeight,
        };
        flowNodes.push(toolUseNode);
        
        if (lastNodeId) {
          flowConnections.push({ from: lastNodeId, to: msg.id });
        }
        
        // Place tool_result to the right
        const resultMsg = messages[i + 1];
        const toolResultNode: FlowNode = {
          id: resultMsg.id,
          type: 'tool_result',
          label: 'Result',
          x: currentX + nodeWidth + horizontalGap,
          y: currentY,
          width: nodeWidth,
          height: nodeHeight,
        };
        flowNodes.push(toolResultNode);
        flowConnections.push({ from: msg.id, to: resultMsg.id });
        
        lastNodeId = resultMsg.id;
        currentY += nodeHeight + verticalGap;
        maxY = Math.max(maxY, currentY);
        i += 2;
      } else {
        // Standard node placement
        const node: FlowNode = {
          id: msg.id,
          type: msg.type as FlowNode['type'],
          label: getLabelForMessage(msg),
          x: currentX,
          y: currentY,
          width: nodeWidth,
          height: nodeHeight,
        };
        flowNodes.push(node);
        
        if (lastNodeId) {
          flowConnections.push({ from: lastNodeId, to: msg.id });
        }
        
        lastNodeId = msg.id;
        currentY += nodeHeight + verticalGap;
        maxY = Math.max(maxY, currentY);
        i++;
      }
    }
    
    return { nodes: flowNodes, connections: flowConnections };
  }, [messages]);

  // Get short label for message
  function getLabelForMessage(msg: AgentMessage): string {
    if (msg.type === 'user') {
      return msg.content.length > 25 ? msg.content.substring(0, 25) + '...' : msg.content;
    }
    if (msg.type === 'tool_use') {
      return msg.toolName || 'Tool';
    }
    if (msg.type === 'assistant') {
      return 'Response';
    }
    if (msg.type === 'system') {
      return 'System';
    }
    if (msg.type === 'result') {
      return 'Final Result';
    }
    return msg.type;
  }

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = container.clientWidth;
    canvas.height = Math.max(container.clientHeight, nodes.length * 100 + 100);

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw connections
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return;

      ctx.beginPath();
      
      // Determine connection points
      const fromCenterX = fromNode.x + fromNode.width / 2;
      const fromCenterY = fromNode.y + fromNode.height / 2;
      const toCenterX = toNode.x + toNode.width / 2;
      const toCenterY = toNode.y + toNode.height / 2;
      
      // If nodes are horizontally adjacent (tool use -> result)
      if (Math.abs(fromCenterY - toCenterY) < 10) {
        // Horizontal connection
        ctx.moveTo(fromNode.x + fromNode.width, fromCenterY);
        ctx.lineTo(toNode.x, toCenterY);
      } else {
        // Vertical connection with curve
        ctx.moveTo(fromCenterX, fromNode.y + fromNode.height);
        const midY = (fromNode.y + fromNode.height + toNode.y) / 2;
        ctx.bezierCurveTo(
          fromCenterX, midY,
          toCenterX, midY,
          toCenterX, toNode.y
        );
      }
      
      ctx.stroke();

      // Draw arrow head
      const angle = Math.atan2(
        toCenterY - fromCenterY,
        toCenterX - fromCenterX
      );
      const arrowLength = 10;
      const arrowX = Math.abs(fromCenterY - toCenterY) < 10 ? toNode.x : toCenterX;
      const arrowY = Math.abs(fromCenterY - toCenterY) < 10 ? toCenterY : toNode.y;
      
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((node, index) => {
      const colors = NODE_COLORS[node.type] || NODE_COLORS.system;
      const isLast = index === nodes.length - 1 && running;

      // Node background
      ctx.fillStyle = colors.bg;
      ctx.strokeStyle = isLast ? '#8b5cf6' : colors.border;
      ctx.lineWidth = isLast ? 3 : 2;
      
      // Rounded rectangle
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(node.x + radius, node.y);
      ctx.lineTo(node.x + node.width - radius, node.y);
      ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + radius);
      ctx.lineTo(node.x + node.width, node.y + node.height - radius);
      ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - radius, node.y + node.height);
      ctx.lineTo(node.x + radius, node.y + node.height);
      ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - radius);
      ctx.lineTo(node.x, node.y + radius);
      ctx.quadraticCurveTo(node.x, node.y, node.x + radius, node.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pulse effect for running node
      if (isLast) {
        ctx.save();
        ctx.strokeStyle = '#8b5cf680';
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();
      }

      // Icon
      ctx.font = '16px system-ui';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.fillText(NODE_ICONS[node.type] || '📄', node.x + 10, node.y + 25);

      // Label
      ctx.font = '12px system-ui';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.fillText(node.label, node.x + 35, node.y + 25);

      // Type badge
      ctx.font = '10px system-ui';
      ctx.fillStyle = colors.text + '99';
      ctx.fillText(node.type.replace('_', ' '), node.x + 35, node.y + 42);
    });

  }, [nodes, connections, running]);

  if (messages.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        <div className="text-center text-zinc-500">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">Agent flow will appear here</p>
          <p className="text-xs mt-1 text-zinc-600">Start the agent to visualize the execution</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative overflow-auto bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
      <canvas ref={canvasRef} className="block" />
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-2 bg-zinc-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
        {Object.entries(NODE_COLORS).slice(0, 4).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
            />
            <span className="text-zinc-400 capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="absolute top-2 right-2 bg-zinc-900/90 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-zinc-400">
        {nodes.length} steps
      </div>
    </div>
  );
}
