package indexer

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// EventSignatureHash computes the keccak256 hash of an event signature string.
func EventSignatureHash(sig string) common.Hash {
	return crypto.Keccak256Hash([]byte(sig))
}

// DecodeUint256 reads a 32-byte big-endian uint256 from ABI-encoded data at
// the given word offset (0-indexed). Each word is 32 bytes.
func DecodeUint256(data []byte, wordOffset int) (*big.Int, error) {
	start := wordOffset * 32
	end := start + 32
	if len(data) < end {
		return nil, fmt.Errorf("data too short: need %d bytes, have %d", end, len(data))
	}
	return new(big.Int).SetBytes(data[start:end]), nil
}

// DecodeUint8 reads a uint8 value from a 32-byte ABI word at the given offset.
func DecodeUint8(data []byte, wordOffset int) (uint8, error) {
	v, err := DecodeUint256(data, wordOffset)
	if err != nil {
		return 0, err
	}
	if !v.IsUint64() || v.Uint64() > 255 {
		return 0, fmt.Errorf("value %s does not fit in uint8", v.String())
	}
	return uint8(v.Uint64()), nil
}

// DecodeAddress extracts an Ethereum address from a 32-byte indexed topic.
func DecodeAddress(topic common.Hash) common.Address {
	return common.BytesToAddress(topic.Bytes()[12:])
}

// DecodeBytes32 converts a common.Hash (32 bytes) to its 0x-prefixed hex string.
func DecodeBytes32(topic common.Hash) string {
	return topic.Hex()
}

// DecodeAddressFromData extracts an address from ABI-encoded data at wordOffset.
func DecodeAddressFromData(data []byte, wordOffset int) (common.Address, error) {
	start := wordOffset * 32
	end := start + 32
	if len(data) < end {
		return common.Address{}, fmt.Errorf("data too short: need %d bytes, have %d", end, len(data))
	}
	return common.BytesToAddress(data[start:end]), nil
}

// DecodeDynamicString reads a dynamic-length string from ABI-encoded data.
// dynWordOffset is the word offset of the pointer to the string data.
func DecodeDynamicString(data []byte, dynWordOffset int) (string, error) {
	ptrVal, err := DecodeUint256(data, dynWordOffset)
	if err != nil {
		return "", fmt.Errorf("reading string pointer: %w", err)
	}

	offset := int(ptrVal.Int64())
	if len(data) < offset+32 {
		return "", fmt.Errorf("data too short for string length at offset %d", offset)
	}

	strLen := new(big.Int).SetBytes(data[offset : offset+32]).Int64()
	strStart := offset + 32
	strEnd := strStart + int(strLen)
	if len(data) < strEnd {
		return "", fmt.Errorf("data too short for string content: need %d, have %d", strEnd, len(data))
	}

	return string(data[strStart:strEnd]), nil
}

// HexToBytes converts a 0x-prefixed hex string to bytes.
func HexToBytes(s string) ([]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	return hex.DecodeString(s)
}

// Uint256ToString formats a *big.Int as a decimal string.
func Uint256ToString(v *big.Int) string {
	if v == nil {
		return "0"
	}
	return v.String()
}
