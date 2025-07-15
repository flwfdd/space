import path from 'node:path';

/**
 * 规范化路径，移除多余的 ./ 和 //
 * @param basePath 基础路径
 * @param relativePath 相对路径
 * @returns 规范化后的路径
 */
export function normalizePath(basePath: string, relativePath?: string): string {
    if (!relativePath) {
        return basePath;
    }

    // 移除开头的 ./ 或 ./
    const cleanRelativePath = relativePath.replace(/^\.\//, '');

    // 使用 path.join 来正确处理路径连接
    const joinedPath = path.join(basePath, cleanRelativePath);

    // 使用 path.normalize 来移除多余的斜杠和点
    return path.normalize(joinedPath);
}

/**
 * 从完整路径中提取相对于基础目录的路径
 * @param fullPath 完整路径
 * @param baseDir 基础目录
 * @returns 相对路径
 */
export function getRelativePath(fullPath: string, baseDir: string): string {
    return path.relative(baseDir, fullPath);
}

/**
 * 检查路径是否为绝对路径
 * @param filePath 文件路径
 * @returns 是否为绝对路径
 */
export function isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath);
}

/**
 * 解析路径，处理 .. 和 . 等特殊字符
 * @param filePath 文件路径
 * @returns 解析后的路径
 */
export function resolvePath(filePath: string): string {
    return path.resolve(filePath);
}
