/**
 * MCP相关类型定义
 * 用于OpenRD知识库API中的MCP服务集成
 */
// ==================== 错误处理类型 ====================
/** MCP错误码 */
export var McpErrorCode;
(function (McpErrorCode) {
    McpErrorCode["SERVICE_UNAVAILABLE"] = "MCP_SERVICE_UNAVAILABLE";
    McpErrorCode["AUTHENTICATION_FAILED"] = "MCP_AUTHENTICATION_FAILED";
    McpErrorCode["INVALID_REQUEST"] = "MCP_INVALID_REQUEST";
    McpErrorCode["RATE_LIMITED"] = "MCP_RATE_LIMITED";
    McpErrorCode["TIMEOUT"] = "MCP_TIMEOUT";
    McpErrorCode["NETWORK_ERROR"] = "MCP_NETWORK_ERROR";
    McpErrorCode["FALLBACK_TRIGGERED"] = "MCP_FALLBACK_TRIGGERED";
})(McpErrorCode || (McpErrorCode = {}));
//# sourceMappingURL=mcp.types.js.map